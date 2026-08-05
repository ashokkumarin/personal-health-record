import { createSyncClient, createAuditClient, createRecordsClient } from "@phr/shared";
import { syncStateKv } from "../db/kv";
import { getDb } from "../db/client";
import { getPendingMutations, clearMutation, bumpMutationRetries } from "../data/mutations";
import { getUnsyncedAuditEntries, markAuditEntriesSynced } from "../audit/local";
import { downloadToLocalStore, fileExtensionForType } from "../documentStore";
import { applyPull } from "./applyPull";

export const CURSOR_KEY = "last_pull_cursor";
// Caps how many missing files this call downloads, so a huge first sync
// doesn't block the UI for minutes — the next sync (foreground/manual/pull-
// to-refresh) picks up wherever this one left off.
const MAX_FILE_DOWNLOADS_PER_SYNC = 25;

export interface SyncResult {
  ok: boolean;
  pushed: number;
  pulled: number;
  filesDownloaded: number;
  error?: string;
}

export async function runSync(serverUrl: string, token: string, deviceId: string): Promise<SyncResult> {
  const syncClient = createSyncClient(serverUrl, token);
  const auditClient = createAuditClient(serverUrl, token);
  const recordsClient = createRecordsClient(serverUrl, token);

  try {
    const pushed = await pushMutations(syncClient, recordsClient, deviceId);
    const pulled = await pullChanges(syncClient, deviceId);
    const filesDownloaded = await downloadMissingFiles(recordsClient);
    await flushAudit(auditClient, deviceId);

    return { ok: true, pushed, pulled, filesDownloaded };
  } catch (err) {
    return {
      ok: false,
      pushed: 0,
      pulled: 0,
      filesDownloaded: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function pushMutations(
  syncClient: ReturnType<typeof createSyncClient>,
  recordsClient: ReturnType<typeof createRecordsClient>,
  deviceId: string
): Promise<number> {
  const pending = await getPendingMutations();
  if (pending.length === 0) return 0;

  const res = await syncClient.push({
    deviceId,
    mutations: pending.map((m) => ({
      clientId: m.clientId,
      entity: m.entity,
      op: m.op,
      data: m.data,
      updatedAt: m.updatedAt,
    })),
  });

  let applied = 0;
  for (const result of res.results) {
    if (result.status === "applied") {
      applied++;
      await clearMutation(result.clientId);
    } else if (result.status === "stale") {
      // Server already has a newer version — drop our stale mutation; the
      // pull step right after brings down the server's winning copy.
      await clearMutation(result.clientId);
    } else {
      await bumpMutationRetries(result.clientId);
    }
  }

  // Upload actual file bytes for any records that were just created.
  const db = await getDb();
  const creates = pending.filter((m) => m.op === "create");
  for (const m of creates) {
    const recordId = m.data.id as string;
    const row = await db.getFirstAsync<{ local_file_path: string | null; file_type: string }>(
      "SELECT local_file_path, file_type FROM records WHERE id = ?",
      [recordId]
    );
    if (row?.local_file_path) {
      try {
        await recordsClient.replaceRecordFile(recordId, {
          uri: row.local_file_path,
          name: recordId,
          type: row.file_type,
        });
        await db.runAsync("UPDATE records SET pending_upload = 0 WHERE id = ?", [recordId]);
      } catch {
        // File upload failed (offline mid-sync, etc) — metadata already
        // landed; pending_upload stays set so a later sync retries it.
      }
    }
  }

  return applied;
}

async function pullChanges(syncClient: ReturnType<typeof createSyncClient>, deviceId: string): Promise<number> {
  const cursor = (await syncStateKv.get(CURSOR_KEY)) ?? undefined;
  const pull = await syncClient.pull(cursor, deviceId);
  await applyPull(pull);
  await syncStateKv.set(CURSOR_KEY, pull.serverTime);
  return pull.families.length + pull.memberships.length + pull.patients.length + pull.records.length;
}

async function downloadMissingFiles(recordsClient: ReturnType<typeof createRecordsClient>): Promise<number> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; file_type: string }>(
    `SELECT id, file_type FROM records
     WHERE deleted = 0 AND local_file_path IS NULL
     LIMIT ${MAX_FILE_DOWNLOADS_PER_SYNC}`
  );

  let downloaded = 0;
  for (const row of rows) {
    try {
      const full = await recordsClient.getRecord(row.id);
      if (!full.downloadUrl) continue;
      const ext = fileExtensionForType(row.file_type);
      const localPath = await downloadToLocalStore(full.downloadUrl, row.id, ext);
      let localThumbnailPath: string | null = null;
      if (full.thumbnailUrl) {
        try {
          localThumbnailPath = await downloadToLocalStore(full.thumbnailUrl, `${row.id}-thumb`, "jpg");
        } catch {
          // Thumbnail is a nice-to-have; the full file above is what matters.
        }
      }
      await db.runAsync("UPDATE records SET local_file_path = ?, local_thumbnail_path = ? WHERE id = ?", [
        localPath,
        localThumbnailPath,
        row.id,
      ]);
      downloaded++;
    } catch {
      // Leave it for the next sync — a single record's failure (deleted
      // server-side between pull and here, network blip) shouldn't abort
      // the whole batch.
    }
  }
  return downloaded;
}

async function flushAudit(auditClient: ReturnType<typeof createAuditClient>, deviceId: string): Promise<void> {
  const unsynced = await getUnsyncedAuditEntries();
  if (unsynced.length === 0) return;

  await auditClient.syncEntries(
    deviceId,
    unsynced.map((e) => ({
      clientId: e.id,
      actorType: e.actorType,
      eventType: e.eventType,
      entityType: e.entityType,
      entityId: e.entityId,
      metadata: e.metadata,
      occurredAt: e.occurredAt,
    }))
  );
  await markAuditEntriesSynced(unsynced.map((e) => e.id));
}
