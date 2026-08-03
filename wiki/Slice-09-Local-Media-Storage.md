# Slice 9: Local Disk Media Storage (replaces MinIO)

Replaces the MinIO/S3-compatible object storage backend with local filesystem storage under a configurable folder, so the app has no object-storage service to run or operate. `apps/api/src/storage.ts`'s public interface (`uploadObject`, `getSignedDownloadUrl`, `deleteObject`) didn't change, so `records.ts` and `users.ts` needed no changes at all.

## 1. Acceptance Criteria

1. Given a file upload (record, replacement file, or user avatar), when it's stored, then the bytes land on local disk under the configured `MEDIA_ROOT` folder rather than in an object storage service.
2. Given `MEDIA_ROOT`, then it is configurable via an environment variable so a deployment can point it at any host path — including a path that becomes a docker volume bind-mount if the API is later containerized.
3. Given a stored file, when a signed download/thumbnail URL is requested, then it points at the API's own `GET /files/*` route and is fetchable directly by a browser `<img>`/`<iframe>` (no `Authorization` header), matching the old S3-presigned-URL behavior.
4. Given a signed URL, when its signature doesn't match the requested key or it has expired, then the request is rejected with 403.
5. Given a storage key containing path-traversal segments (`..`), then it is rejected rather than resolving outside `MEDIA_ROOT`.
6. Given records/avatars created before this migration, when the migration runs, then their existing files are copied from MinIO into `MEDIA_ROOT` under the same keys, so existing database rows keep working without any data migration in Postgres itself.

## 2. Explicitly Deferred

- Containerizing the API itself (it continues to run on the host via `npm run dev`/`npm start`, per the user's explicit choice — see this slice's design discussion). `docker-compose.yml` no longer runs MinIO but still only manages `postgres`.
- Pluggable storage backends (e.g. choosing between local disk and S3 via config) — local disk only.

## 3. Tasks

1. Rewrite `apps/api/src/storage.ts`: `uploadObject`/`deleteObject` operate on `MEDIA_ROOT` via `node:fs`; `getSignedDownloadUrl` builds an HMAC-signed URL to `/files/*` instead of calling S3's presigner; `ensureMediaRoot()` replaces `ensureBucket()`.
2. New `apps/api/src/routes/files.ts`: unauthenticated `GET /files/*` route that verifies the HMAC signature/expiry (`verifyFileSignature`) before streaming the file, with content type derived from the file extension.
3. `apps/api/src/server.ts`: call `ensureMediaRoot()` at startup instead of `ensureBucket()`.
4. Remove `@aws-sdk/client-s3` / `@aws-sdk/s3-request-presigner` from `apps/api/package.json`.
5. `.env.example`/`.env`/`apps/api/.env.test(.example)`: replace `S3_*` vars with `MEDIA_ROOT` and `API_PUBLIC_URL`; test env points `MEDIA_ROOT` at a separate `./data/media-test` folder so test runs don't touch dev data.
6. `docker-compose.yml`: remove the `minio` service and its volume.
7. One-time migration: copy every object referenced by an existing `MedicalRecord.filePath`/`thumbnailPath` or `User.avatarPath` from the MinIO bucket into `MEDIA_ROOT` under the same key, so no existing database row needs to change.

## 4. Test List (`apps/api/src/routes/records.test.ts`, `users.test.ts`)

No new test files — existing upload/thumbnail/replace/delete/avatar tests (Slices 3, 6, 7) already exercise `uploadObject`/`getSignedDownloadUrl`/`deleteObject` through the same call sites; they continue to pass unchanged against the new local-disk implementation (`ensureBucket()` calls in test setup renamed to `ensureMediaRoot()`).

Manually verified (not asserted in the automated suite, since it requires a live HTTP round-trip against `/files/*`): an uploaded image and its generated thumbnail both download correctly through their signed URLs; a request with a tampered signature, a missing signature, or an expired timestamp is rejected with 403; a path-traversal attempt against `/files/*` is rejected.

## 5. Definition of Done

- All 66 tests in the `apps/api` suite pass against the new storage backend.
- `apps/api` typechecks; `cd apps/web && npx next build` succeeds unaffected (the web app never talked to storage directly).
- Manually confirmed: a real image/PDF upload's thumbnail and original file both serve correctly via `GET /files/*`; tampered/expired/missing signatures and path traversal are all rejected.
- Every object referenced by an existing database row was confirmed present and byte-identical under `MEDIA_ROOT` after the migration script ran.
