import * as Crypto from "expo-crypto";
import type { FamilyDetail, PatientProfile } from "@phr/shared";
import { getDb } from "../db/client";

export interface LocalPatientSummary {
  id: string;
  name: string;
}

interface FamilyRow {
  id: string;
  name: string;
  owner_id: string;
  my_role: string | null;
  updated_at: string;
}

interface PatientRow {
  id: string;
  family_id: string;
  linked_user_id: string | null;
  name: string;
  date_of_birth: string | null;
  gender: string | null;
  visible_to_family: number;
  relation: string | null;
  updated_at: string;
}

function rowToPatient(row: PatientRow): PatientProfile {
  return {
    id: row.id,
    familyId: row.family_id,
    linkedUserId: row.linked_user_id,
    name: row.name,
    dateOfBirth: row.date_of_birth,
    gender: row.gender,
    visibleToFamily: row.visible_to_family === 1,
    createdAt: row.updated_at,
    updatedAt: row.updated_at,
  };
}

// Local mirror never caches member name/email (applyPull doesn't persist
// them), so the fallback views built from these functions always render an
// empty memberships list — acceptable in the offline path since the actual
// blocker (reaching Upload / a patient's Health Record) doesn't depend on it.
async function rowToFamilyDetail(db: Awaited<ReturnType<typeof getDb>>, row: FamilyRow): Promise<FamilyDetail> {
  const patients = await db.getAllAsync<PatientRow>(
    "SELECT * FROM patients WHERE family_id = ? AND deleted = 0",
    [row.id]
  );
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    createdAt: row.updated_at,
    updatedAt: row.updated_at,
    myRole: (row.my_role as FamilyDetail["myRole"]) ?? undefined,
    memberships: [],
    patients: patients.map(rowToPatient),
  };
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

// The local `families` table only ever contains families already in scope
// for this device — either the single bootstrapped standalone family, or
// families pulled down for this user's memberships (see applyPull.ts) — so
// no further per-user filtering is needed here.
export async function getLocalFamiliesForDrawer(): Promise<FamilyDetail[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<FamilyRow>(
    "SELECT * FROM families WHERE deleted = 0 ORDER BY updated_at ASC"
  );
  return Promise.all(rows.map((row) => rowToFamilyDetail(db, row)));
}

export async function getLocalFamilyDetail(familyId: string): Promise<FamilyDetail | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<FamilyRow>("SELECT * FROM families WHERE id = ? AND deleted = 0", [
    familyId,
  ]);
  if (!row) return null;
  return rowToFamilyDetail(db, row);
}

// Standalone mode has no server, ever — this bootstraps a home for the
// device's own records so Timeline/Upload/FamilyDetail all have something to
// show instead of hanging on "no family found". Idempotent: no-ops once any
// non-deleted family already exists.
export async function ensureDefaultLocalFamily(userId: string, userName: string): Promise<void> {
  const db = await getDb();
  const existing = await db.getFirstAsync<{ id: string }>("SELECT id FROM families WHERE deleted = 0 LIMIT 1");
  if (existing) return;

  const now = new Date().toISOString();
  const familyId = Crypto.randomUUID();
  const patientId = Crypto.randomUUID();

  await db.runAsync(
    `INSERT INTO families (id, name, owner_id, my_role, updated_at, deleted)
     VALUES (?, ?, ?, 'OWNER', ?, 0)`,
    [familyId, "My Family", userId, now]
  );
  await db.runAsync(
    `INSERT INTO patients
      (id, family_id, linked_user_id, name, date_of_birth, gender, visible_to_family, relation, updated_at, deleted)
     VALUES (?, ?, ?, ?, NULL, NULL, 1, NULL, ?, 0)`,
    [patientId, familyId, userId, userName, now]
  );
}

export async function createLocalFamilyMember(
  familyId: string,
  fields: { name: string; relation?: string }
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  const id = Crypto.randomUUID();
  await db.runAsync(
    `INSERT INTO patients
      (id, family_id, linked_user_id, name, date_of_birth, gender, visible_to_family, relation, updated_at, deleted)
     VALUES (?, ?, NULL, ?, NULL, NULL, 0, ?, ?, 0)`,
    [id, familyId, fields.name, fields.relation ?? null, now]
  );
}
