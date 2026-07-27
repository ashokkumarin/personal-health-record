# Slice 6: Navigation, Profile & Settings (Web)

Reworks the web app's navigation and account-management surfaces once Slices 1–5 made family/patient/record data available: a personal home timeline as the landing page, a sidebar tree for moving between families and patients, a profile page with optional avatar/phone, and a settings page that owns family creation/rename/delete and member removal (moved out of the old top-level "Families" nav item).

## 1. Acceptance Criteria

1. Given a logged-in user, when they log in, then they land on `/` showing their own linked patient's timeline (title `"<Patient name>'s Timeline"`), not a families list.
2. Given a user with no linked patient profile, when they view `/`, then they see an explanatory empty state instead of a timeline.
3. Given the hamburger menu, when opened, then it shows a tree: each family the user belongs to as a parent node, with that family's patients as children; selecting a patient navigates to that patient's timeline.
4. Given the top nav, when the user has pending approval requests, then the notification bell is enabled and badge-counted; otherwise it is disabled. Clicking it opens `/approvals`.
5. Given the profile page, when the user edits name/email/photo/mobile number, then the update is saved; photo and mobile number are optional, name and email are mandatory.
6. Given the settings page, when the user creates a new family from it, then the family appears in the sidebar tree without a page reload artifact (stale list) — matches Slice 2's family-creation flow, just relocated in the UI.
7. Given a family owner/admin, when they rename or (soft-)delete a family from settings/families list, then the change is reflected immediately; a deleted family no longer appears for its members.
8. Given a family owner/admin, when they remove a member, then that member's `FamilyMembership` is removed and they no longer see that family.
9. Given any of the above list/detail pages, when the user switches account (login/logout) or switches selected patient via the sidebar, then the page reflects the new session/patient immediately (no stale cached UI from the previous session/patient).

## 2. Explicitly Deferred

- Mobile parity for the sidebar tree / settings reorganization — mobile keeps its existing simpler list/detail screens.
- Editable family-level settings beyond name and soft-delete (e.g. transferring ownership) — still deferred per Slice 2.

## 3. Tasks

1. Migration: `Family.deletedAt DateTime?`; unique family-name constraint scoped to non-deleted rows (partial unique index).
2. `apps/api`: `DELETE /families/:id` (soft delete), `PATCH /families/:id` (rename), `DELETE /families/:id/members/:userId` (remove member), `GET /me/timeline`.
3. `apps/api`: `User.photoUrl`, `User.mobileNumber` (nullable) + `PATCH /users/me` accepting optional photo upload and mobile number.
4. `apps/web`: `Sidebar.tsx` (MUI `SimpleTreeView`/`TreeItem`), `Nav.tsx` rework (hamburger + logo + notification bell + avatar menu), home page (`/`) as personal timeline, `/profile` (name/email/photo/mobile), `/settings` (family create/rename/delete entry points, moved off the top nav).
5. Root-layout-level session/route-change handling so `Nav` re-reads the stored session on every navigation (it never remounts across client-side route changes) and timeline pages re-fetch when the `patientId` query param changes without a full remount.

## 4. Test List

`apps/api`:
- `PATCH /families/:id`: owner/admin can rename; non-owner/admin gets 403; duplicate active name gets 409.
- `DELETE /families/:id`: soft-deletes; deleted family's name can be reused by a new family; members no longer see it listed.
- `DELETE /families/:id/members/:userId`: owner/admin can remove a member; the member's own profile linkage is cleared.
- `GET /me/timeline`: returns the caller's own linked patient and records, or `patient: null` if unlinked.
- `PATCH /users/me`: updates name/email/photo/mobile; email/name required, photo/mobile optional.

## 5. Definition of Done

- All tests above pass against real Postgres.
- Manually confirmed: login lands on the personal timeline; sidebar tree navigates between families/patients without stale UI; profile photo/mobile save correctly as optional fields; settings page creates/renames/deletes a family and the sidebar/list reflect it immediately; removing a member drops their access.
