import * as Crypto from "expo-crypto";
import type { AuditActorType, MobileAuditEventType } from "@phr/shared";
import { getDb } from "../db/client";

export interface LocalAuditInput {
  actorType: AuditActorType;
  eventType: MobileAuditEventType;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export interface LocalAuditRow extends LocalAuditInput {
  id: string;
  occurredAt: string;
}

// Written immediately on every login/logout/upload/edit/delete so the
// on-device history works fully offline; SyncEngine flushes unsynced rows to
// the server's audit log when a connection is available (see lib/sync).
export async function recordLocalAuditEvent(input: LocalAuditInput): Promise<void> {
  const db = await getDb();
  const id = Crypto.randomUUID();
  await db.runAsync(
    `INSERT INTO audit_log (id, actor_type, event_type, entity_type, entity_id, metadata, occurred_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      id,
      input.actorType,
      input.eventType,
      input.entityType ?? null,
      input.entityId ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
      new Date().toISOString(),
    ]
  );
}

export async function getUnsyncedAuditEntries(): Promise<LocalAuditRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    actor_type: AuditActorType;
    event_type: MobileAuditEventType;
    entity_type: string | null;
    entity_id: string | null;
    metadata: string | null;
    occurred_at: string;
  }>("SELECT * FROM audit_log WHERE synced = 0 ORDER BY occurred_at ASC");

  return rows.map((r) => ({
    id: r.id,
    actorType: r.actor_type,
    eventType: r.event_type,
    entityType: r.entity_type ?? undefined,
    entityId: r.entity_id ?? undefined,
    metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
    occurredAt: r.occurred_at,
  }));
}

export async function markAuditEntriesSynced(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  const placeholders = ids.map(() => "?").join(",");
  await db.runAsync(`UPDATE audit_log SET synced = 1 WHERE id IN (${placeholders})`, ids);
}
