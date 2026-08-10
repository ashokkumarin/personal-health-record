import { getDb } from "./client";
import { syncStateKv } from "./kv";
import { CURSOR_KEY } from "../sync/syncEngine";
import { deleteLocalFile, fileExtensionForType } from "../documentStore";

// Wipes the local mirror of a server account's families/memberships/patients/
// records (and any not-yet-pushed mutations against it), plus the downloaded
// document files backing them. Called when disconnecting to standalone mode —
// that cached data belongs to the server account, not the device's new
// local-only identity, so leaving it in place would show the previous
// account's family group to whoever uses the device offline next. Safe to
// call on an already-empty mirror (fresh installs going straight to
// standalone) since every step is a no-op then.
export async function resetLocalServerMirror(): Promise<void> {
  const db = await getDb();

  const records = await db.getAllAsync<{
    id: string;
    file_type: string;
    local_file_path: string | null;
    local_thumbnail_path: string | null;
  }>("SELECT id, file_type, local_file_path, local_thumbnail_path FROM records");

  for (const r of records) {
    if (r.local_file_path) deleteLocalFile(r.id, fileExtensionForType(r.file_type));
    if (r.local_thumbnail_path) deleteLocalFile(`${r.id}-thumb`, "jpg");
  }

  await db.execAsync(`
    DELETE FROM records;
    DELETE FROM patients;
    DELETE FROM memberships;
    DELETE FROM families;
    DELETE FROM pending_mutations;
  `);

  await syncStateKv.delete(CURSOR_KEY);
}
