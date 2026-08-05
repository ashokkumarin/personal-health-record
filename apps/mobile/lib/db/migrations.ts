// Each entry is applied once, in order, tracked via SQLite's `PRAGMA
// user_version` (see client.ts). Append new migrations here — never edit an
// already-shipped one, same convention as the API's Prisma migrations.
export const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS server_config (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS sync_state (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS families (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    my_role TEXT,
    updated_at TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS memberships (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL,
    relation TEXT,
    updated_at TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL,
    linked_user_id TEXT,
    name TEXT NOT NULL,
    date_of_birth TEXT,
    gender TEXT,
    visible_to_family INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    record_type TEXT NOT NULL,
    title TEXT NOT NULL,
    file_type TEXT NOT NULL,
    ocr_text TEXT,
    captured_at TEXT,
    uploaded_at TEXT NOT NULL,
    created_by_id TEXT,
    updated_at TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    local_file_path TEXT,
    local_thumbnail_path TEXT,
    pending_upload INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS pending_mutations (
    client_id TEXT PRIMARY KEY,
    entity TEXT NOT NULL,
    op TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    retries INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    actor_type TEXT NOT NULL,
    event_type TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    metadata TEXT,
    occurred_at TEXT NOT NULL,
    synced INTEGER NOT NULL DEFAULT 0
  );
  `,
];
