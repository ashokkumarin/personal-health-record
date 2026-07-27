# Slice 5: Sharing & Visibility

Implements requirements-and-project-plan.md Section 6.6 as a single toggle rather than a separate request/grant workflow (user's choice — see technical-design.md).

## 1. Acceptance Criteria

1. Given a patient profile with no linked user account (owner/admin-managed), then its records are visible to all active members of the family by default.
2. Given a patient profile linked to its own user account, then its records are NOT visible to other family members by default — only to the linked user.
3. Given the linked user sets `visibleToFamily: true`, then other active family members can subsequently see that patient's records.
4. Given a user who is not the patient's linked user, when they attempt to change visibility, then the request is rejected with 403 — including for unlinked patients, where there is no one to ask.
5. A linked user can always see their own records regardless of the `visibleToFamily` value.

## 2. Explicitly Deferred

- Per-record (as opposed to per-patient) visibility overrides.
- A ShareRequest-style approval workflow for sharing — this slice uses a direct toggle instead, since the linked user already has full authority over their own visibility per requirements doc Section 6.6.
- AuditLog — not tied to a concrete acceptance criterion in mvp-spec.md; deferred.

## 3. Tasks

1. Migration: `PatientProfile.visibleToFamily Boolean @default(false)`.
2. Visibility rule enforced in both `GET /records/:id` and `GET /families/:familyId/records` (Slices 3–4).
3. `PATCH /patients/:id/visibility { visibleToFamily }`.
4. Tests written first (see below).
5. `packages/shared`: `setPatientVisibility` client method.
6. Web: visibility toggle on the family detail page, shown only to the linked user.

## 4. Test List (written before implementation, part of `apps/api/src/routes/records.test.ts`)

- `visibility: unlinked patient's records visible to owner/admin by default` (AC1)
- `visibility: linked patient's records hidden from other members by default` (AC2)
- `visibility: after opting in, other members can see the records` (AC3)
- `visibility: non-linked-user gets 403 changing visibility` (AC4)

## 5. Definition of Done

- All tests above pass.
- Manually confirmed: as the linked user, toggling visibility on the web UI changes what a second family member's timeline shows.
