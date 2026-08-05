import { getDb } from "./client";

async function getValue(table: "server_config" | "sync_state", key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string | null }>(
    `SELECT value FROM ${table} WHERE key = ?`,
    [key]
  );
  return row?.value ?? null;
}

async function setValue(table: "server_config" | "sync_state", key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO ${table} (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}

async function deleteValue(table: "server_config" | "sync_state", key: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM ${table} WHERE key = ?`, [key]);
}

export const serverConfigKv = {
  get: (key: string) => getValue("server_config", key),
  set: (key: string, value: string) => setValue("server_config", key, value),
  delete: (key: string) => deleteValue("server_config", key),
};

export const syncStateKv = {
  get: (key: string) => getValue("sync_state", key),
  set: (key: string, value: string) => setValue("sync_state", key, value),
  delete: (key: string) => deleteValue("sync_state", key),
};
