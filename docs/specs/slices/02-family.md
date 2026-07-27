# Slice 2: Family & Patient Profile Management

Implements requirements-and-project-plan.md Section 6.2 (full model, not mvp-spec.md's narrower version) — family ownership/admins, and all three ways of adding a family member.

## 1. Acceptance Criteria

1. Given an authenticated user, when they create a family, then they become its `OWNER` with an `ACTIVE` membership.
2. Given a family owner, when they promote an existing member to `ADMIN`, then that membership's role updates; a non-owner attempting this is rejected with 403.
3. Given an owner/admin, when they add a member with mode `no_account`, then a `PatientProfile` is created with `linkedUserId = null` (owner/admin manages it on the member's behalf).
4. Given an owner/admin, when they add a member with mode `new_account`, then a new `User`, an `ACTIVE` `MEMBER` membership, and a linked `PatientProfile` are created immediately — no approval step.
5. Given an owner/admin, when they add a member with mode `link_existing` to an existing user's email, then a `PENDING` `ApprovalRequest` and a `PENDING` membership are created, and the patient profile stays unlinked until approved.
6. Given the target user of a pending approval request, when they approve it, then the patient profile links to their account and their membership becomes `ACTIVE`.
7. Given the target user, when they reject it, then the patient profile stays unlinked and the pending membership is removed.
8. Given a user who is not an owner/admin of the family, when they attempt to add a member or promote an admin, then the request is rejected with 403.
9. Given a user already a member of a family, when they are added again, then the request is rejected with 409.
10. Given an unauthenticated request to any route in this slice, then it is rejected with 401.

## 2. Explicitly Deferred

- Transferring or removing family ownership (requirements doc notes admins have "the same rights as owner except transferring/removing ownership" — no endpoint does either yet, so this can't yet be violated).
- Record-level visibility rules (requirements doc Section 6.6) — deferred to the Upload/Sharing slice, since there are no records yet.
- Mobile UI for the three-mode add-member flow and the approvals screen — mobile gets list/detail screens only this slice (see technical-design.md).

## 3. Tasks

1. Prisma models: `Family`, `FamilyMembership`, `PatientProfile`, `ApprovalRequest` + enums, migration.
2. JWT verification middleware (`apps/api/src/plugins/authenticate.ts`) — prerequisite, since every route here is protected.
3. `packages/shared`: split into `auth.ts`/`family.ts`; add family schemas, types, and client methods.
4. `apps/api`: `families.ts` and `approvals.ts` routes.
5. Tests written first: one per acceptance criterion above.
6. `apps/web`: families list/detail pages, add-member form (3 modes), approvals page, logout affordance.
7. `apps/mobile`: families list + read-only detail screens.

## 4. Test List (written before implementation)

In `apps/api/src/routes/families.test.ts`:
- `create family: creator becomes OWNER/ACTIVE` (AC1)
- `promote admin: owner can promote a member` (AC2)
- `promote admin: non-owner gets 403` (AC2, AC8)
- `add member (no_account): patient profile has no linked user` (AC3)
- `add member (new_account): creates user + active membership + linked patient` (AC4)
- `add member (link_existing): creates pending approval + pending membership, patient unlinked` (AC5)
- `add member: non-owner/admin gets 403` (AC8)
- `add member: adding the same user twice returns 409` (AC9)
- `all routes: unauthenticated request returns 401` (AC10)

In `apps/api/src/routes/approvals.test.ts`:
- `approve: target user approving links patient + activates membership` (AC6)
- `reject: target user rejecting leaves patient unlinked, removes membership` (AC7)
- `approve/reject: a user who isn't the target gets 403`

## 5. Definition of Done

- All tests above pass against real Postgres.
- Web: can create a family, add a member all three ways, and (as the second account) see and act on a pending approval.
- Mobile: can view families and their members/patients (read-only for this slice).
