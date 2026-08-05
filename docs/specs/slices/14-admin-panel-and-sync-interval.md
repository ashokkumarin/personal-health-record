# Slice 14: Admin Panel, Password Reset Workflow, and Mobile Sync Interval

Before this slice there was no system-level admin concept (only per-family `FamilyRole`), no way to list/manage all users, no audit-log viewer (entries were only ever written, never read back), no password-reset flow, and no notification mechanism of any kind. The mobile app synced only on launch and on foreground-resume, with no user-configurable interval. This slice adds all of the above.

## 1. Acceptance Criteria

1. Given a fresh deploy with `ADMIN_EMAIL`/`ADMIN_PASSWORD` set, when the API starts, then that account exists with `isAdmin: true` (idempotent — safe across restarts).
2. Given an admin is logged in, then they can list all users, create a new user (with an option to force a password change on first login), edit a user's name/email/phone, and delete a user.
3. Given an admin deletes a user, then that user's family memberships, their own linked patient profile, and its records are soft-deleted; families they solely own are soft-deleted too; families they own **with other active members** block the deletion (`CANNOT_REMOVE_OWNER`) until reassigned; records they created for other patients are left untouched. Every step is recorded in the audit log.
4. Given an admin, then they can view the audit log (filterable by user/event type/date range, paginated) and reset any user's password (setting `mustChangePassword: true`).
5. Given a user creation or password reset with the "force change" option, when that user next logs in, then both web and mobile block all other screens until they change their password (`POST /users/me/password`, which also clears the flag).
6. Given a user on the login screen who can't access their email, when they submit "Forgot password", then no email is sent (there's no SMTP infra) — instead a `PasswordResetRequest` is queued and shown to admins, who resolve it with a new temporary password (same force-change effect as #4).
7. Given the mobile app connected to a server, then Settings → Server has a "Sync every (minutes)" field, clamped to 1–180 (default 15), and background sync fires on that interval in addition to the existing launch/foreground triggers.

## 2. Explicitly Deferred

- Real email delivery — no SMTP infrastructure exists in this app; "forgot password" is admin-notification-only by design (confirmed with the user rather than assumed).
- A "promote user to admin" API/UI — additional admins can only be created directly in the database today; only the bootstrapped `ADMIN_EMAIL` account is admin out of the box.
- Auto-transferring family ownership on user deletion — deleting an owner with other active members is blocked outright rather than silently reassigning ownership, so a family's structure never changes without an explicit action.
- Hard delete — every removal in this slice is a soft delete (`deletedAt`), consistent with the rest of the schema (`Family`, `PatientProfile`, `MedicalRecord`, `FamilyMembership` all already worked this way).

## 3. Tasks

1. `apps/api/prisma/schema.prisma`: `User.isAdmin`, `User.mustChangePassword`, `User.deletedAt`; new `PasswordResetRequest` model + `PasswordResetStatus` enum; `AuditEventType` extended with `ADMIN_CREATE_USER`, `ADMIN_UPDATE_USER`, `ADMIN_DELETE_USER`, `ADMIN_RESET_PASSWORD`, `PASSWORD_RESET_REQUESTED`, `PASSWORD_CHANGED`. Migration: `20260805081236_add_admin_and_password_reset`.
2. `apps/api/src/bootstrap.ts` (new): `ensureAdminUser()`, called from `server.ts` before `listen()` — not from `buildApp()`, so it never touches the test database.
3. `apps/api/src/plugins/requireAdmin.ts` (new): DB-backed `isAdmin` check (not JWT-based, so revocation is immediate).
4. `apps/api/src/routes/admin.ts` (new): `GET/POST /admin/users`, `PATCH/DELETE /admin/users/:id`, `POST /admin/users/:id/reset-password`, `GET /admin/audit-log`, `GET /admin/password-reset-requests`, `POST /admin/password-reset-requests/:id/resolve`. Cascading soft-delete logic wrapped in `prisma.$transaction`.
5. `apps/api/src/routes/auth.ts`: `login` rejects soft-deleted users; new public `POST /auth/forgot-password`. `apps/api/src/routes/users.ts`: `POST /users/me/password` now also clears `mustChangePassword` and records `PASSWORD_CHANGED`.
6. `packages/shared/src/admin.ts` (new): `createAdminClient`, request/response schemas and types. `auth.ts`/`audit.ts` extended (`User.isAdmin`/`mustChangePassword`, `forgotPasswordSchema`, widened `AuditEventType`, new `MobileAuditEventType` kept narrow for the mobile-originated audit-sync path).
7. `apps/web`: `app/login/page.tsx` (forgot-password dialog + `mustChangePassword` redirect), `app/change-password/page.tsx` (new), `app/components/Nav.tsx` (forced-change gate + Admin menu item), `app/admin/` (new: `page.tsx`, `UsersSection.tsx`, `PasswordResetRequestsSection.tsx`, `AuditLogSection.tsx`), `lib/api.ts` (`adminClient()`).
8. `apps/mobile`: `lib/serverConfigContext.tsx` (`syncIntervalMinutes`, clamped 1–180), `screens/settings/ServerSection.tsx` (numeric input), `lib/sync/syncContext.tsx` (interval timer alongside the existing mount/foreground triggers), `screens/ChangePasswordScreen.tsx` (new), `navigation/RootNavigator.tsx` (routes to it when `mustChangePassword`).
9. `apps/api/src/test-utils.ts`: `resetDb()` includes `passwordResetRequest`; new `registerAdmin()` helper. `apps/api/src/routes/admin.test.ts` (new, 14 tests) covering authorization, CRUD, cascade-delete rules, audit-log reads, and the forgot-password → resolve round trip.
10. `.env` / `.env.example` / `docker/release/.env.example` / `docker-compose.yml` / `docker/release/docker-compose.yml`: `ADMIN_EMAIL`, `ADMIN_PASSWORD`.

## 4. Test List

- `apps/api/src/routes/admin.test.ts`: non-admin/unauthenticated rejection, admin CRUD (create with `forceChangePassword`, duplicate email 409, edit, reset-password forces change on next login), self-delete and family-owner-with-other-members blocks, solo-user cascade (family/membership/user all soft-deleted, audit entry written, login blocked afterward), audit-log ordering, forgot-password → admin list → resolve → login round trip, and that an unknown email doesn't leak a request or a non-`ok:true` response.
- Full existing suite (`npm run test:api`) re-run clean (98 tests) — no regressions in auth/users/families/records/sync/audit/approvals.
- `packages/shared`, `apps/api`, `apps/web`, `apps/mobile` all typecheck clean.
- Manual: web admin create/edit/delete/reset flows, mobile forced-password screen, mobile sync-interval field persists and changes the interval timer's cadence.

## 5. Definition of Done

- All four workspaces (`packages/shared`, `apps/api`, `apps/web`, `apps/mobile`) typecheck with no errors.
- `npm run test:api` passes (98/98).
- API and web Docker images rebuilt and the running containers force-recreated (image rebuild alone doesn't recreate a running container — see [Deployment](../../deployment.md#rebuilding-after-code-changes)); `prisma migrate deploy` applied.
- Documentation updated: this slice doc, `docs/data-model.md`, `docs/api-reference.md`, `docs/apps/{web-app,mobile-app,backend-service}.md`, `docs/deployment.md`, root `README.md`, and the `wiki/` mirrors of each.
