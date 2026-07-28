# Slice 3: Document Upload

Implements requirements-and-project-plan.md Section 6.3 (Record Ingestion) — capturing/uploading a document and storing it against a patient, with best-effort OCR.

> Storage backend note: this slice originally stored files in MinIO (S3-compatible object storage). Slice 9 (`09-local-media-storage.md`) later replaced that with local disk storage behind the same `storage.ts` interface — everything below describing "MinIO" reflects the original implementation; the current backend is local disk.

## 1. Acceptance Criteria

1. Given an active member of a patient's family, when they upload a supported file (JPEG, PNG, or PDF) for that patient, then a `MedicalRecord` is created with the file stored in MinIO and metadata (type, title, uploader) persisted.
2. Given an unsupported file type, when a user attempts to upload it, then the request is rejected with 400.
3. Given a user who is not a member of the patient's family, when they attempt to upload, then the request is rejected with 403.
4. Given an unauthenticated request, then it is rejected with 401.
5. Given a successfully uploaded image or PDF, the system attempts best-effort OCR in the background and stores any extracted text on the record — this does not block the upload response and is not guaranteed to succeed.

## 2. Explicitly Deferred

- Advanced/high-accuracy OCR or structured data extraction (requirements doc Section 11 — explicitly out of scope for MVP).
- Editing/deleting an uploaded record.
- Mobile camera capture UX polish — a basic picker (camera/gallery/PDF) is included, no cropping/annotation.

## 3. Tasks

1. Prisma `MedicalRecord` model + `RecordType` enum + migration.
2. `apps/api/src/storage.ts` — MinIO client (`ensureBucket`, `uploadObject`, `getSignedDownloadUrl`).
3. `apps/api/src/ocr.ts` — `extractText(buffer, mimeType)`, best-effort, never throws.
4. `apps/api/src/routes/records.ts` — `POST /patients/:patientId/records`, `GET /records/:id`.
5. Tests written first (see below).
6. `packages/shared`: `records.ts` (types, upload client using `FormData`).
7. Web: upload form on the family detail page.
8. Mobile: a basic Upload screen (`expo-image-picker` / `expo-document-picker`).

## 4. Test List (written before implementation, `apps/api/src/routes/records.test.ts`)

- `upload: family member can upload a supported file` (AC1)
- `upload: unsupported file type is rejected with 400` (AC2)
- `upload: non-member of the patient's family gets 403` (AC3)
- `upload: unauthenticated request gets 401` (AC4)

OCR (AC5) is verified manually, not asserted automatically — it's async and inherently non-deterministic (see technical-design.md Section 7).

## 5. Definition of Done

- All tests above pass against real Postgres + a real MinIO instance.
- A real image/PDF uploaded through the web UI appears with a working download link, and `ocrText` eventually populates on `GET /records/:id`.
