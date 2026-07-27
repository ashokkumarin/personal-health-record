# Slice 7: Record Thumbnails, Preview, Edit & Delete

Upgrades the timeline from a plain text row per record (Slice 4) to a thumbnail grid, adds a click-to-preview dialog, and gives the uploader/family owner/admin/linked patient the ability to edit a record's metadata, replace its underlying file, or delete it.

## 1. Acceptance Criteria

1. Given a supported image (`image/jpeg`/`image/png`) or PDF upload, when the file finishes uploading, then a thumbnail is generated (resized image, or a real rendered first page for PDFs) and shown in the timeline grid in place of a plain text row.
2. Given a file type or content that can't be thumbnailed, then the record still uploads successfully and shows a generic file-type tile instead of failing.
3. Given a thumbnail tile, when the user clicks it, then a preview dialog opens showing the full image or an embedded PDF viewer, without leaving the timeline page.
4. Given a record's uploader, the family's owner/admin, or the record's own linked patient, when they open a record's overflow menu, then they can edit its title/type/document date and optionally replace the underlying file, or delete the record entirely.
5. Given a family member who is none of the above (not uploader, not owner/admin, not the record's linked patient), when they attempt to edit, replace, or delete a record, then the request is rejected with 403.
6. Given a record's file is replaced, then its thumbnail, file type, and OCR text are regenerated/reset for the new file; the old file and thumbnail are removed from storage.
7. Given a record is deleted, then its database row and both its storage objects (original file and thumbnail, if any) are removed.

## 2. Explicitly Deferred

- Thumbnails for file types other than JPEG/PNG/PDF (none are currently accepted by upload validation, so none are needed).
- Bulk edit/delete across multiple records at once.

## 3. Tasks

1. Migration: `MedicalRecord.thumbnailPath String?` (nullable — best-effort, same contract as `ocrText`).
2. `apps/api`: `thumbnail.ts` (`generateThumbnail`, best-effort, never throws) — `sharp` for image resizing; `pdfjs-dist` (legacy Node build) + `canvas` to render a PDF's first page, then `sharp` again to normalize to a small JPEG.
3. `apps/api`: `storage.ts` gains `deleteObject`; upload route generates and stores a thumbnail; `GET /records/:id`, `GET /families/:familyId/records`, `GET /me/timeline` attach a freshly-signed `thumbnailUrl`.
4. `apps/api`: `canManageRecord()` permission helper (uploader, family owner/admin, or the record's own linked patient); `PATCH /records/:id` (metadata), `PUT /records/:id/file` (replace file + regenerate thumbnail + re-run OCR), `DELETE /records/:id` (removes DB row + storage objects).
5. `packages/shared`: `MedicalRecord.thumbnailUrl`, `updateRecordFieldsSchema`, `updateRecord`/`deleteRecord`/`replaceRecordFile` client methods.
6. `apps/web`: `RecordGrid.tsx` (thumbnail grid, preview dialog, edit dialog with optional file replacement, delete confirm dialog) — used by both the family timeline page and the personal home timeline.

## 4. Test List (`apps/api/src/routes/records.test.ts`)

- `thumbnail generation`: uploading a supported image produces a record whose `GET /records/:id` has a truthy `thumbnailUrl` (AC1).
- `DELETE /records/:id`: uploader can delete own record; family owner/admin can delete someone else's upload; the record's own linked patient can delete it even if someone else uploaded it; an unrelated active member gets 403; the DB row is confirmed gone afterward (AC4, AC5, AC7).
- `PATCH /records/:id`: updates title/type/date; unrelated member gets 403 (AC4, AC5).
- `PUT /records/:id/file`: replaces the file (new `filePath`, regenerated `thumbnailUrl`); unrelated member gets 403 (AC4, AC5, AC6).

## 5. Definition of Done

- All tests above pass against real Postgres (66/66 in the full `apps/api` suite as of this slice).
- `npm run build:shared` and `cd apps/web && npx next build` both succeed.
- Manually confirmed end-to-end: a real uploaded image and a real uploaded PDF each render an actual thumbnail (verified the PDF thumbnail is a genuine rendered first page, not a placeholder icon); clicking either opens the correct preview; edit, file-replace, and delete all work for an authorized user and are rejected with 403 for an unrelated member.
