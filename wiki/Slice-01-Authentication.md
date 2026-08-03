# Slice 1: Authentication

Implements Story 1 and Story 2's prerequisite ([MVP Spec](MVP-Spec)) — account creation, login, logout. Reference implementation for the spec → tasks → tests → code workflow used by every later slice.

## 1. Acceptance Criteria (from MVP Spec Section 6)

1. Given a valid name, email, and password, when a user registers, then an account is created and a session token is returned.
2. Given an email that is already registered, when a user attempts to register with it again, then registration is rejected with a clear error.
3. Given a registered user's correct email and password, when they log in, then they receive a session token.
4. Given an incorrect email or password, when a user attempts to log in, then the attempt is rejected with a clear error.
5. Given invalid input (e.g. missing fields, malformed email, too-short password), when a user submits the register or login form, then validation errors are shown before/without hitting the database.

## 2. Explicitly Deferred

- Password reset (requirements doc Section 6.1) — future slice.
- Phone-based login (requirements doc Section 6.1) — future slice.
- Refresh tokens / session revocation — stateless JWT only for MVP (see [Technical Design](Technical-Design) Section 3).

## 3. Tasks

1. Prisma `User` model + migration ([Technical Design](Technical-Design) Section 4).
2. `packages/shared`: `registerSchema`, `loginSchema` (Zod), `User`/`AuthResponse` types, typed API client methods (`register`, `login`, `logout`).
3. `apps/api`: `/auth/register`, `/auth/login`, `/auth/logout` routes ([Technical Design](Technical-Design) Section 5), password hashing, JWT issuance.
4. `apps/api` tests (written first): one per acceptance criterion above.
5. `apps/web`: `/register` and `/login` pages using the shared client/schemas.
6. `apps/mobile`: register/login screens using the shared client/schemas.

## 4. Test List (written before implementation)

In `apps/api/src/routes/auth.test.ts`:
- `register: creates a user and returns a token` (AC1)
- `register: rejects a duplicate email with 409` (AC2)
- `register: rejects invalid input with 400 and does not hit the database` (AC5)
- `login: returns a token for correct credentials` (AC3)
- `login: rejects incorrect password with 401` (AC4)
- `login: rejects unknown email with 401` (AC4)

## 5. Definition of Done

- All tests above pass against a real Postgres instance (docker-compose), not a mocked DB.
- Web and mobile can both register a new account and log in against the running API.
- Duplicate-email and invalid-credential errors are shown clearly in both UIs.
