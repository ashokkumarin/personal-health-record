import { getDb } from "../db/client";

export type MutationOp = "create" | "update" | "delete";

export interface PendingMutation {
  clientId: string;
  entity: "record";
  op: MutationOp;
  data: Record<string, unknown>;
  updatedAt: string;
}

export async function enqueueMutation(m: PendingMutation): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO pending_mutations (client_id, entity, op, payload, created_at, retries)
     VALUES (?, ?, ?, ?, ?, 0)
     ON CONFLICT(client_id) DO UPDATE SET payload = excluded.payload`,
    [
      m.clientId,
      m.entity,
      m.op,
      JSON.stringify({ data: m.data, updatedAt: m.updatedAt }),
      new Date().toISOString(),
    ]
  );
}

export async function getPendingMutations(): Promise<PendingMutation[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    client_id: string;
    entity: string;
    op: string;
    payload: string;
  }>("SELECT * FROM pending_mutations ORDER BY created_at ASC");

  return rows.map((r) => {
    const parsed = JSON.parse(r.payload) as { data: Record<string, unknown>; updatedAt: string };
    return {
      clientId: r.client_id,
      entity: r.entity as "record",
      op: r.op as MutationOp,
      data: parsed.data,
      updatedAt: parsed.updatedAt,
    };
  });
}

export async function clearMutation(clientId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM pending_mutations WHERE client_id = ?", [clientId]);
}

export async function bumpMutationRetries(clientId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE pending_mutations SET retries = retries + 1 WHERE client_id = ?", [clientId]);
}
