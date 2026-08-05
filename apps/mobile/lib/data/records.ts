import * as Crypto from "expo-crypto";
import type {
  MedicalRecord,
  MyTimeline,
  PatientProfile,
  RecordFilters,
  RecordType,
  UpdateRecordFields,
  UploadRecordFields,
} from "@phr/shared";
import { getDb } from "../db/client";
import { enqueueMutation } from "./mutations";
import { storeLocalFile, deleteLocalFile, fileExtensionForType } from "../documentStore";

interface RecordRow {
  id: string;
  patient_id: string;
  record_type: RecordType;
  title: string;
  file_type: string;
  ocr_text: string | null;
  captured_at: string | null;
  uploaded_at: string;
  created_by_id: string | null;
  updated_at: string;
  deleted: number;
  local_file_path: string | null;
  local_thumbnail_path: string | null;
  pending_upload: number;
}

function rowToRecord(row: RecordRow): MedicalRecord {
  return {
    id: row.id,
    patientId: row.patient_id,
    recordType: row.record_type,
    title: row.title,
    // Not meaningful locally (that's a server storage key) — local reads/
    // writes go through local_file_path/downloadUrl instead.
    filePath: row.local_file_path ?? "",
    fileType: row.file_type,
    thumbnailPath: null,
    ocrText: row.ocr_text,
    capturedAt: row.captured_at,
    uploadedAt: row.uploaded_at,
    createdById: row.created_by_id ?? "",
    updatedAt: row.updated_at,
    downloadUrl: row.local_file_path ?? undefined,
    thumbnailUrl: row.local_thumbnail_path ?? row.local_file_path ?? null,
  };
}

export async function getLocalPatientForUser(userId: string): Promise<PatientProfile | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    id: string;
    family_id: string;
    linked_user_id: string | null;
    name: string;
    date_of_birth: string | null;
    gender: string | null;
    visible_to_family: number;
    updated_at: string;
  }>("SELECT * FROM patients WHERE linked_user_id = ? AND deleted = 0", [userId]);
  if (!row) return null;
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

export async function listLocalRecordsForPatient(patientId: string): Promise<MedicalRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<RecordRow>(
    `SELECT * FROM records WHERE patient_id = ? AND deleted = 0
     ORDER BY COALESCE(captured_at, uploaded_at) DESC`,
    [patientId]
  );
  return rows.map(rowToRecord);
}

export async function getMyLocalTimeline(userId: string): Promise<MyTimeline> {
  const patient = await getLocalPatientForUser(userId);
  if (!patient) return { patient: null, records: [] };
  const records = await listLocalRecordsForPatient(patient.id);
  return { patient, records };
}

export async function listLocalFamilyRecords(
  familyId: string,
  userId: string,
  filters: RecordFilters = {}
): Promise<MedicalRecord[]> {
  const db = await getDb();
  const patients = await db.getAllAsync<{
    id: string;
    linked_user_id: string | null;
    visible_to_family: number;
  }>("SELECT id, linked_user_id, visible_to_family FROM patients WHERE family_id = ? AND deleted = 0", [
    familyId,
  ]);

  let visiblePatientIds = patients
    .filter((p) => p.linked_user_id === null || p.linked_user_id === userId || p.visible_to_family === 1)
    .map((p) => p.id);

  if (filters.patientId) {
    visiblePatientIds = visiblePatientIds.filter((id) => id === filters.patientId);
  }
  if (visiblePatientIds.length === 0) return [];

  const placeholders = visiblePatientIds.map(() => "?").join(",");
  const params: (string | number)[] = [...visiblePatientIds];
  let sql = `SELECT * FROM records WHERE patient_id IN (${placeholders}) AND deleted = 0`;

  if (filters.recordType) {
    sql += " AND record_type = ?";
    params.push(filters.recordType);
  }
  if (filters.dateFrom) {
    sql += " AND COALESCE(captured_at, uploaded_at) >= ?";
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    sql += " AND COALESCE(captured_at, uploaded_at) <= ?";
    params.push(filters.dateTo);
  }
  if (filters.q) {
    sql += " AND (title LIKE ? OR ocr_text LIKE ?)";
    params.push(`%${filters.q}%`, `%${filters.q}%`);
  }
  sql += " ORDER BY COALESCE(captured_at, uploaded_at) DESC";

  const rows = await db.getAllAsync<RecordRow>(sql, params);
  return rows.map(rowToRecord);
}

export async function getLocalRecord(id: string): Promise<MedicalRecord | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<RecordRow>("SELECT * FROM records WHERE id = ? AND deleted = 0", [id]);
  return row ? rowToRecord(row) : null;
}

export async function createLocalRecord(
  userId: string,
  patientId: string,
  fields: UploadRecordFields,
  file: { uri: string; type: string }
): Promise<MedicalRecord> {
  const db = await getDb();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  const ext = fileExtensionForType(file.type);
  const localPath = storeLocalFile(file.uri, id, ext);

  await db.runAsync(
    `INSERT INTO records
      (id, patient_id, record_type, title, file_type, ocr_text, captured_at, uploaded_at,
       created_by_id, updated_at, deleted, local_file_path, local_thumbnail_path, pending_upload)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, 0, ?, NULL, 1)`,
    [id, patientId, fields.recordType, fields.title, file.type, fields.capturedAt ?? null, now, userId, now, localPath]
  );

  await enqueueMutation({
    clientId: Crypto.randomUUID(),
    entity: "record",
    op: "create",
    data: {
      id,
      patientId,
      recordType: fields.recordType,
      title: fields.title,
      fileType: file.type,
      capturedAt: fields.capturedAt ?? null,
    },
    updatedAt: now,
  });

  return (await getLocalRecord(id))!;
}

export async function updateLocalRecord(id: string, fields: UpdateRecordFields): Promise<MedicalRecord | null> {
  const db = await getDb();
  const now = new Date().toISOString();

  const sets: string[] = [];
  const params: (string | null)[] = [];
  if (fields.recordType) {
    sets.push("record_type = ?");
    params.push(fields.recordType);
  }
  if (fields.title) {
    sets.push("title = ?");
    params.push(fields.title);
  }
  if (fields.capturedAt !== undefined) {
    sets.push("captured_at = ?");
    params.push(fields.capturedAt ?? null);
  }
  sets.push("updated_at = ?");
  params.push(now);
  params.push(id);

  await db.runAsync(`UPDATE records SET ${sets.join(", ")} WHERE id = ?`, params);

  await enqueueMutation({
    clientId: Crypto.randomUUID(),
    entity: "record",
    op: "update",
    data: { id, ...fields },
    updatedAt: now,
  });

  return getLocalRecord(id);
}

export async function deleteLocalRecord(id: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  const existing = await db.getFirstAsync<RecordRow>("SELECT * FROM records WHERE id = ?", [id]);

  await db.runAsync("UPDATE records SET deleted = 1, updated_at = ? WHERE id = ?", [now, id]);

  if (existing?.local_file_path) {
    deleteLocalFile(id, fileExtensionForType(existing.file_type));
  }

  await enqueueMutation({
    clientId: Crypto.randomUUID(),
    entity: "record",
    op: "delete",
    data: { id },
    updatedAt: now,
  });
}
