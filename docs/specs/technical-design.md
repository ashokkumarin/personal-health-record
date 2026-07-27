# Technical Design

**Status: MVP v1.0 — all 8 slices delivered.**

This document translates [requirements-and-project-plan.md](../requirements-and-project-plan.md) and [mvp-spec.md](mvp-spec.md) into a concrete architecture. It is the shared reference for every slice spec in `slices/`. Sections below describe the as-built system; each slice doc under `slices/` has the authoritative acceptance criteria for the piece it introduced.

## 1. Repo Layout (npm workspaces monorepo)

```
apps/
  api/            Node + TypeScript + Fastify + Prisma (Postgres)
  web/            Next.js web dashboard
  mobile/         Expo (React Native) app
packages/
  shared/         Shared TypeScript types + Zod schemas + API client, consumed by api/web/mobile
docker-compose.yml   Local Postgres + MinIO (S3-compatible storage) for dev
```

One `package.json` at the root defines the npm workspaces; each app/package has its own `package.json` and `tsconfig.json`. `packages/shared` is built once and imported by the other three so request/response shapes can't drift between backend and clients.

## 2. Request Flow

```
apps/web, apps/mobile
      │  (fetch, using packages/shared's typed client + Zod schemas)
      ▼
apps/api (Fastify)
      │  (Prisma Client)
      ▼
Postgres
```

File uploads go directly from the API process to MinIO/S3 (`apps/api/src/storage.ts`); downloads and thumbnails are served via short-lived signed URLs (`getSignedDownloadUrl`) computed locally (HMAC), not proxied through the API.

## 3. Auth Strategy (Slice 1)

- Passwords hashed with bcrypt.
- Stateless JWT access token returned on register/login, sent as `Authorization: Bearer <token>` on subsequent requests.
- No refresh tokens or password reset (requirements doc Section 6.1 mentions these; still deferred — see `slices/01-auth.md`).
- Phone-based login is a future addition; email/password only for v1.0.

## 4. Data Model

As built (final MVP v1.0 schema — see `apps/api/prisma/schema.prisma` for the authoritative source of truth):

| Entity | Slice introduced | Notes |
|---|---|---|
| User | 01-auth | Gains `photoUrl`, `mobileNumber` (nullable) in Slice 6 |
| Family, FamilyMembership | 02-family | `Family.deletedAt` (soft delete) added in Slice 6 |
| PatientProfile | 02-family | `visibleToFamily` added in Slice 5 |
| ApprovalRequest | 02-family | |
| MedicalRecord | 03-upload | `thumbnailPath` added in Slice 7 |

`ShareRequest`/`AuditLog` from the original requirements doc were not needed: visibility is a per-patient toggle (Slice 5) rather than a request/grant workflow, and no acceptance criterion needed an audit trail.

### Representative Prisma schema (abbreviated — see the actual schema file for the full definition)

```prisma
model User {
  id           String   @id @default(uuid())
  name         String
  email        String   @unique
  passwordHash String
  photoUrl     String?
  mobileNumber String?
  createdAt    DateTime @default(now())
}

model Family {
  id        String   @id @default(uuid())
  name      String
  ownerId   String
  deletedAt DateTime?
  createdAt DateTime @default(now())
}

model PatientProfile {
  id              String   @id @default(uuid())
  familyId        String
  linkedUserId    String?
  name            String
  visibleToFamily Boolean  @default(false)
  createdAt       DateTime @default(now())
}

model MedicalRecord {
  id            String     @id @default(uuid())
  patientId     String
  recordType    RecordType
  title         String
  filePath      String
  fileType      String
  thumbnailPath String?
  ocrText       String?
  capturedAt    DateTime?
  uploadedAt    DateTime   @default(now())
  createdById   String
}
```

## 5. API Contract (as built)

Full request/response shapes are defined in `packages/shared` (Zod schemas + TS types) and enforced identically by every route below. See each slice doc for the acceptance criteria driving these endpoints.

| Area | Routes |
|---|---|
| Auth (01) | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout` |
| Family (02, 06) | `POST /families`, `GET /families`, `GET /families/:id`, `PATCH /families/:id`, `DELETE /families/:id`, `POST /families/:id/members`, `DELETE /families/:id/members/:userId`, `PATCH /families/:id/members/:userId/role` |
| Approvals (02) | `GET /approval-requests`, `POST /approval-requests/:id/approve`, `POST /approval-requests/:id/reject` |
| Records (03, 04, 07) | `POST /patients/:patientId/records`, `GET /records/:id`, `GET /families/:familyId/records`, `GET /me/timeline`, `PATCH /records/:id`, `PUT /records/:id/file`, `DELETE /records/:id` |
| Visibility (05) | `PATCH /patients/:id/visibility` |
| Users (06) | `GET /users/me`, `PATCH /users/me`, `POST /users/me/password` |

Example (`POST /auth/register`):
- Request: `{ name: string, email: string, password: string }`
- 201 → `{ user: { id, name, email, createdAt }, token: string }`
- 409 → duplicate email: `{ error: "EMAIL_ALREADY_REGISTERED" }`
- 400 → validation failure: `{ error: "VALIDATION_ERROR", details: [...] }`

## 6. Local Dev Environment

`docker-compose.yml` provides:
- `postgres` — dev/test database
- `minio` — S3-compatible storage for original files and generated thumbnails

`.env.example` documents `DATABASE_URL`, `JWT_SECRET`, `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`.

Schema changes are applied as hand-written SQL migrations under `apps/api/prisma/migrations/` (`prisma migrate dev` requires an interactive data-loss confirmation this environment can't provide), run via `prisma migrate deploy` against both `.env` (dev) and `.env.test` (test) databases, followed by `prisma generate`.

## 7. Testing Strategy

- `apps/api`: Vitest, using Fastify's `.inject()` against a real test Postgres (via docker-compose) — no mocked DB, per the acceptance-criteria-first approach in mvp-spec.md Section 7.
- One test per acceptance criterion in each slice spec, written before the implementing code. 66 tests across the suite as of MVP v1.0.
- Web/mobile: manual verification per slice; automated UI tests are a future addition once the interaction patterns stabilize.

## 8. Thumbnail Generation (Slice 7)

- Images (`image/jpeg`, `image/png`): resized via `sharp` to fit within 300×300, encoded as JPEG.
- PDFs: first page rendered via `pdfjs-dist` (legacy Node build) + `canvas` (node-canvas), then re-encoded through `sharp` to the same normalized JPEG format — a real rendered page, not a placeholder icon.
- `generateThumbnail()` never throws; any failure (unsupported type, corrupt file) returns `null` and the UI falls back to a generic file-type tile. Same best-effort contract as OCR (`ocr.ts`).
