import type { SyncPullResponse } from "@phr/shared";
import { getDb } from "../db/client";

export async function applyPull(pull: SyncPullResponse): Promise<void> {
  const db = await getDb();

  for (const f of pull.families) {
    await db.runAsync(
      `INSERT INTO families (id, name, owner_id, my_role, updated_at, deleted)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name, owner_id = excluded.owner_id, my_role = excluded.my_role,
         updated_at = excluded.updated_at, deleted = excluded.deleted`,
      [f.id, f.name, f.ownerId, f.myRole ?? null, f.updatedAt, f.deleted ? 1 : 0]
    );
  }

  for (const m of pull.memberships) {
    await db.runAsync(
      `INSERT INTO memberships (id, family_id, user_id, role, status, relation, updated_at, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         family_id = excluded.family_id, user_id = excluded.user_id, role = excluded.role,
         status = excluded.status, relation = excluded.relation, updated_at = excluded.updated_at,
         deleted = excluded.deleted`,
      [
        m.id,
        m.familyId,
        m.userId,
        m.role,
        m.status,
        m.relation ?? null,
        m.updatedAt,
        m.deleted ? 1 : 0,
      ]
    );
  }

  for (const p of pull.patients) {
    await db.runAsync(
      `INSERT INTO patients (id, family_id, linked_user_id, name, date_of_birth, gender, visible_to_family, updated_at, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         family_id = excluded.family_id, linked_user_id = excluded.linked_user_id, name = excluded.name,
         date_of_birth = excluded.date_of_birth, gender = excluded.gender,
         visible_to_family = excluded.visible_to_family, updated_at = excluded.updated_at,
         deleted = excluded.deleted`,
      [
        p.id,
        p.familyId,
        p.linkedUserId,
        p.name,
        p.dateOfBirth,
        p.gender,
        p.visibleToFamily ? 1 : 0,
        p.updatedAt,
        p.deleted ? 1 : 0,
      ]
    );
  }

  // local_file_path/local_thumbnail_path/pending_upload are deliberately not
  // touched here — those are locally-managed and would otherwise get wiped
  // every time the record's metadata is re-pulled.
  for (const r of pull.records) {
    await db.runAsync(
      `INSERT INTO records
        (id, patient_id, record_type, title, file_type, ocr_text, captured_at, uploaded_at,
         created_by_id, updated_at, deleted, local_file_path, local_thumbnail_path, pending_upload)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 0)
       ON CONFLICT(id) DO UPDATE SET
         patient_id = excluded.patient_id, record_type = excluded.record_type, title = excluded.title,
         file_type = excluded.file_type, ocr_text = excluded.ocr_text, captured_at = excluded.captured_at,
         uploaded_at = excluded.uploaded_at, created_by_id = excluded.created_by_id,
         updated_at = excluded.updated_at, deleted = excluded.deleted`,
      [
        r.id,
        r.patientId,
        r.recordType,
        r.title,
        r.fileType,
        r.ocrText,
        r.capturedAt,
        r.uploadedAt,
        r.createdById,
        r.updatedAt,
        r.deleted ? 1 : 0,
      ]
    );
  }
}
