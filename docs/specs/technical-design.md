# Technical Design

This document translates [requirements-and-project-plan.md](../requirements-and-project-plan.md) and [mvp-spec.md](mvp-spec.md) into a concrete architecture. It is the shared reference for every slice spec in `slices/`.

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

File uploads (future Upload slice) will go directly from client to MinIO/S3 via a signed URL issued by the API, not proxied through the API process.

## 3. Auth Strategy (Slice 1)

- Passwords hashed with bcrypt.
- Stateless JWT access token returned on register/login, sent as `Authorization: Bearer <token>` on subsequent requests.
- No refresh tokens or password reset in Slice 1 (requirements doc Section 6.1 mentions these; they're deferred — see `slices/01-auth.md`).
- Phone-based login is a future addition; Slice 1 is email/password only.

## 4. Data Model

Full target model (requirements doc Section 8), for reference — not all created yet:

| Entity | Slice introduced |
|---|---|
| User | 01-auth |
| Family, FamilyMembership | 02-family (future) |
| PatientProfile | 03-patient-profile (future) |
| MedicalRecord | 04-upload (future) |
| ShareRequest, ApprovalRequest, AuditLog | future sharing/approval slice |

### Slice 1 Prisma schema

```prisma
model User {
  id           String   @id @default(uuid())
  name         String
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
}
```

Later slices extend this file; each slice spec states exactly which models/fields it adds.

## 5. API Contract (Slice 1)

### `POST /auth/register`
Request: `{ name: string, email: string, password: string }`
- 201 → `{ user: { id, name, email, createdAt }, token: string }`
- 409 → duplicate email: `{ error: "EMAIL_ALREADY_REGISTERED" }`
- 400 → validation failure: `{ error: "VALIDATION_ERROR", details: [...] }`

### `POST /auth/login`
Request: `{ email: string, password: string }`
- 200 → `{ user: { id, name, email, createdAt }, token: string }`
- 401 → `{ error: "INVALID_CREDENTIALS" }`

### `POST /auth/logout`
No server-side session to invalidate (stateless JWT for MVP) — client discards the token. Endpoint exists for API symmetry and future session-based auth.
- 200 → `{ ok: true }`

## 6. Local Dev Environment

`docker-compose.yml` provides:
- `postgres` — dev/test database
- `minio` — S3-compatible storage, wired into `apps/api` config now so the Upload slice doesn't need infra changes, but no upload code exists yet.

`.env.example` documents `DATABASE_URL`, `JWT_SECRET`, `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`.

## 7. Testing Strategy

- `apps/api`: Vitest, using Fastify's `.inject()` against a real test Postgres (via docker-compose) — no mocked DB, per the acceptance-criteria-first approach in mvp-spec.md Section 7.
- One test per acceptance criterion in each slice spec, written before the implementing code.
- Web/mobile: manual verification per slice for the MVP phase; automated UI tests are a future addition once the interaction patterns stabilize.
