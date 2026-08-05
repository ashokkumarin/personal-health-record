import { getDb } from "../db/client";

export interface LocalPatientSummary {
  id: string;
  name: string;
}

export async function getLocalPatientName(patientId: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ name: string }>(
    "SELECT name FROM patients WHERE id = ? AND deleted = 0",
    [patientId]
  );
  return row?.name ?? null;
}

export async function listLocalPatientsForFamily(familyId: string): Promise<LocalPatientSummary[]> {
  const db = await getDb();
  return db.getAllAsync<LocalPatientSummary>(
    "SELECT id, name FROM patients WHERE family_id = ? AND deleted = 0",
    [familyId]
  );
}
