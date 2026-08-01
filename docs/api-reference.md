# API Reference

Base URL: `API_PUBLIC_URL` (default `http://localhost:4000` in dev). All
request/response bodies are JSON except file uploads (`multipart/form-data`)
and file downloads (raw bytes).

- [Conventions](#conventions)
- [Auth](#auth)
- [Users](#users)
- [Families](#families)
- [Approvals](#approvals)
- [Records](#records)
- [Files](#files)

## Conventions

**Authentication.** Every route except `/auth/*` and `/files/*` requires:
```
Authorization: Bearer <jwt>
```
Missing or invalid tokens return `401 { "error": "UNAUTHENTICATED" }`. Tokens
are issued by `/auth/register`/`/auth/login`, contain `{ sub: userId, email }`,
and expire after **7 days** — there is no refresh-token flow; the client just
re-authenticates.

**Errors.** Non-2xx responses are `{ "error": "SOME_CODE", ...extra }`. Zod
validation failures return `400 VALIDATION_ERROR` with a `details` field
(`zodError.flatten()`); domain errors (already-registered email, wrong
password, etc.) return the specific code listed under each route below, with
no `details` field.

**Soft delete.** Families are soft-deleted (`deletedAt` set, row kept). Every
family route filters on `deletedAt: null`; a soft-deleted family behaves as if
it were `404 NOT_FOUND` for all purposes except that its name can be reused by
a new family (see [Data model](data-model.md#family)).

---

## Auth

Routes in `apps/api/src/routes/auth.ts`. **No authentication required.**

### `POST /auth/register`
```ts
// Request
{ name: string;     // min 1 char
  email: string;    // valid email
  password: string; // min 8 chars
}

// 201
{ user: User; token: string }
```
| Status | Error code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | schema failure |
| 409 | `EMAIL_ALREADY_REGISTERED` | email already exists |

### `POST /auth/login`
```ts
// Request
{ email: string; password: string }

// 200
{ user: User; token: string }
```
| Status | Error code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | schema failure |
| 401 | `INVALID_CREDENTIALS` | unknown email **or** wrong password (same code for both — no user enumeration) |

### `POST /auth/logout`
No body, no auth check — purely a signal for the client to discard its token.
Always `200 { ok: true }`.

---

## Users

Routes in `apps/api/src/routes/users.ts`. **Auth required** for all.

The `User` shape returned throughout the API:
```ts
interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  themeColor: string | null;           // hex, e.g. "#00695c" — banner color
  defaultTimelineView: "grid" | "list" | null;
  dateOfBirth: string | null;          // ISO datetime
  address: string | null;
  createdAt: string;                   // ISO datetime
  avatarUrl: string | null;            // signed URL, 15 min TTL — see Files
}
```

### `GET /users/me`
`200 User` for the authenticated caller.

### `PATCH /users/me`
```ts
// Request (all fields optional)
{ name?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;     // parsed to Date
  address?: string;
  themeColor?: string;      // must match /^#[0-9a-fA-F]{6}$/
  defaultTimelineView?: "grid" | "list";
}

// 200
User
```
| Status | Error code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | schema failure |
| 409 | `EMAIL_ALREADY_REGISTERED` | new email collides with another account |

### `POST /users/me/password`
```ts
// Request
{ currentPassword: string; newPassword: string /* min 8 */ }

// 200
{ ok: true }
```
| Status | Error code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | schema failure |
| 401 | `INVALID_CREDENTIALS` | `currentPassword` doesn't match |

### `POST /users/me/photo`
`multipart/form-data`, field name `file`. Accepts `image/jpeg` / `image/png`
only, **max 5 MB**.
```ts
// 200
User   // with a fresh avatarUrl
```
| Status | Error code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | missing file or unsupported mimetype |

---

## Families

Routes in `apps/api/src/routes/families.ts`. **Auth required** for all.
Manager = family role `OWNER` or `ADMIN`; most mutating routes require it.

```ts
interface Family {
  id: string; name: string; ownerId: string; createdAt: string;
  myRole?: "OWNER" | "ADMIN" | "MEMBER";  // present on list/get responses
}
interface FamilyDetail extends Family {
  memberships: FamilyMembership[];
  patients: PatientProfile[];
}
interface FamilyMembership {
  id: string; familyId: string; userId: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  status: "ACTIVE" | "PENDING";
  relation: string | null;
  user: { id: string; name: string; email: string };
  createdAt: string;
}
interface PatientProfile {
  id: string; familyId: string; linkedUserId: string | null;
  name: string; dateOfBirth: string | null; gender: string | null;
  visibleToFamily: boolean; createdAt: string;
}
```

### `POST /families`
```ts
{ name: string } → 201 Family
```
Creates the family **and** an `OWNER` membership for the caller in one
transaction. `409 FAMILY_NAME_TAKEN` if the name collides with another
non-deleted family; `400 VALIDATION_ERROR` on schema failure.

### `GET /families`
`200 Family[]` — every family the caller has a membership in (any status),
each with `myRole`.

### `GET /families/:id`
`200 FamilyDetail`. `403 FORBIDDEN` if the caller has no membership row at all;
`404 NOT_FOUND` if the family doesn't exist or is soft-deleted.

### `PATCH /families/:id` (rename)
```ts
{ name: string } → 200 Family
```
Requires manager role. `403 FORBIDDEN` / `404 NOT_FOUND` as above,
`409 FAMILY_NAME_TAKEN` on collision, `400 VALIDATION_ERROR` on schema failure.

### `DELETE /families/:id` (soft delete)
Requires manager role. `204` on success. Does **not** delete patient profiles
or their records — they remain accessible to anyone who already had access.

### `POST /families/:id/admins` (promote to admin)
```ts
{ userId: string } → 200 FamilyMembership
```
Requires the caller to be specifically the `OWNER` — an `ADMIN` **cannot**
promote another member. `404 NOT_FOUND` if the family isn't active or the
target has no membership.

### `POST /families/:id/members` (add member)
Requires manager role. Body is a discriminated union on `mode`:

**`mode: "no_account"`** — a dependent with no login of their own:
```ts
{ mode: "no_account"; name: string; relation?: string;
  dateOfBirth?: string; gender?: string }
→ 201 PatientProfile   // no linkedUserId
```

**`mode: "new_account"`** — creates a brand-new user *and* links them:
```ts
{ mode: "new_account"; name: string; relation?: string;
  dateOfBirth?: string; gender?: string;
  email: string; password: string /* min 8 */ }
→ 201 PatientProfile
```
Creates `User` + `FamilyMembership (MEMBER, ACTIVE)` + `PatientProfile` in one
transaction. `409 EMAIL_ALREADY_REGISTERED` if the email is taken.

**`mode: "link_existing"`** — links an already-registered user:
```ts
{ mode: "link_existing"; name: string; relation?: string;
  dateOfBirth?: string; gender?: string;
  existingUserEmail: string }
→ 201 PatientProfile
```
Two very different outcomes depending on who's being linked:
- **Self-service** (the existing user is already an active member of *this*
  family, e.g. an owner linking their own account): creates the
  `PatientProfile` immediately, no approval step.
- **Cross-user link** (anyone else): creates a `PatientProfile` (unlinked so
  far), a `PENDING` `FamilyMembership`, and an `ApprovalRequest` targeting that
  user — see [Approvals](#approvals). The profile only becomes linked once they
  approve.

| Status | Error code | When (link_existing) |
|---|---|---|
| 404 | `NOT_FOUND` | no user with `existingUserEmail` |
| 409 | `ALREADY_LINKED` | that user already has a patient profile elsewhere |
| 409 | `ALREADY_MEMBER` | already a member of this family (and it isn't the self-service case) |

`400 VALIDATION_ERROR` on schema failure for any mode.

### `DELETE /families/:id/members/:userId`
Requires manager role. `204` on success. `400 CANNOT_REMOVE_OWNER` if the
target holds the `OWNER` role. Removes only the membership row — the linked
`PatientProfile` and their records are untouched.

---

## Approvals

Routes in `apps/api/src/routes/approvals.ts`. **Auth required** for all.
These exist solely to gate the cross-user branch of
`POST /families/:id/members` (`mode: "link_existing"`) — see above.

```ts
interface ApprovalRequest {
  id: string; patientId: string; targetUserId: string; requestedById: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  patient: PatientProfile;
}
```

### `GET /approval-requests`
`200 ApprovalRequest[]` — pending requests where the caller is `targetUserId`.

### `POST /approval-requests/:id/approve`
`200 ApprovalRequest`. Links the patient profile to the caller
(`patient.linkedUserId = caller`), activates the associated family membership,
marks the request `APPROVED`. `404 NOT_FOUND` if the request doesn't exist,
`403 FORBIDDEN` if the caller isn't the `targetUserId`.

### `POST /approval-requests/:id/reject`
`200 ApprovalRequest`. Deletes the `PENDING` family membership created at
add-member time and marks the request `REJECTED`. The `PatientProfile` itself
is left in place, unlinked. Same `404`/`403` rules as approve.

---

## Records

Routes in `apps/api/src/routes/records.ts`. **Auth required** for all.
Only three MIME types are ever accepted: `image/jpeg`, `image/png`,
`application/pdf`.

```ts
type RecordType = "PRESCRIPTION" | "LAB_REPORT" | "PHARMACY_BILL" | "NOTE";

interface MedicalRecord {
  id: string; patientId: string; recordType: RecordType; title: string;
  filePath: string; fileType: string; thumbnailPath: string | null;
  ocrText: string | null; capturedAt: string | null; uploadedAt: string;
  createdById: string;
  downloadUrl?: string;      // only on GET /records/:id — see Files
  thumbnailUrl?: string | null;
}
```

### Authorization model
Three independent checks, used in different combinations per route:
- **`isFamilyMember`** — any membership row (active or pending) in the
  patient's family.
- **`isRecordVisible`** — true if the patient has no linked user, **or** the
  caller *is* the linked user, **or** `patient.visibleToFamily === true`.
- **`canManageRecord`** — true if the caller uploaded the record, **or** is the
  patient's linked user, **or** is a family manager (`OWNER`/`ADMIN`).

Uploading only requires family membership (any member can add a document for
any patient in the family); *viewing* additionally requires visibility;
*editing/deleting* requires management rights. See
[Data model → Authorization model](data-model.md#authorization-model) for the
full table.

### `POST /patients/:patientId/records`
`multipart/form-data`, **max 25 MB**. Fields: `file` (required),
`recordType` (required), `title` (required), `capturedAt` (optional).
```ts
201 MedicalRecord   // + thumbnailUrl, no downloadUrl
```
Generates a thumbnail synchronously (blocks the response) and kicks off OCR
text extraction in the background (`ocrText` appears a moment later — see
[C3 — Component](architecture/c3-component.md#thumbnail-generation-is-synchronous-ocr-is-not)).
`403 FORBIDDEN` if not a family member; `404 NOT_FOUND` if the patient doesn't
exist; `400 VALIDATION_ERROR` on missing/invalid fields or unsupported file
type.

### `PUT /records/:id/file` (replace the underlying file)
Same multipart shape as upload, minus the metadata fields. Regenerates the
thumbnail, **clears `ocrText`** and re-runs extraction, deletes the old
file/thumbnail from storage (best-effort). `200 MedicalRecord` + `thumbnailUrl`.
`403 FORBIDDEN` via `canManageRecord`, `404 NOT_FOUND`, `400 VALIDATION_ERROR`.

### `GET /me/timeline`
No params — always the caller's own linked patient.
```ts
200 { patient: PatientProfile | null; records: MedicalRecord[] }
```
`{ patient: null, records: [] }` if the caller has no linked patient profile
yet. Records ordered `capturedAt desc` (nulls last), then `uploadedAt desc`.

### `GET /records/:id`
`200 MedicalRecord` — the **only** endpoint that includes `downloadUrl`.
`403 FORBIDDEN` if not a family member, or if `isRecordVisible` fails.
`404 NOT_FOUND` if missing.

### `GET /families/:familyId/records`
Query params (all optional):

| Param | Type | Behavior |
|---|---|---|
| `patientId` | string | scope to one patient — `404` if that patient isn't in the family at all |
| `recordType` | `RecordType` | exact match |
| `dateFrom` / `dateTo` | ISO date | inclusive range on `capturedAt` |
| `q` | string | case-insensitive substring match against **both** `title` and `ocrText` |

`200 MedicalRecord[]` (with `thumbnailUrl`, no `downloadUrl`), scoped to
patients visible to the caller. `403 FORBIDDEN` if not a family member.

### `PATCH /patients/:id/visibility`
```ts
{ visibleToFamily: boolean } → 200 PatientProfile
```
**Only the linked patient themself** can toggle this — not even a family
`OWNER` can flip someone else's visibility. `403 FORBIDDEN` otherwise,
`404 NOT_FOUND` if the patient doesn't exist.

### `PATCH /records/:id`
```ts
{ recordType?: RecordType; title?: string; capturedAt?: string | null }
→ 200 MedicalRecord   // + thumbnailUrl
```
`capturedAt: null` explicitly clears the field (vs. omitting the key, which
leaves it unchanged). `403 FORBIDDEN` via `canManageRecord`, `404 NOT_FOUND`,
`400 VALIDATION_ERROR`.

### `DELETE /records/:id`
`204` on success. Deletes the DB row, then best-effort deletes the file and
thumbnail from storage. `403 FORBIDDEN` via `canManageRecord`, `404 NOT_FOUND`.

---

## Files

Route in `apps/api/src/routes/files.ts`. **No auth header** — access is gated
entirely by a signed, time-limited URL instead (see
[C3 — filesRoutes](architecture/c3-component.md#filesroutes) for why).

### `GET /files/*`
The wildcard is the storage key (e.g. `patientId/uuid-filename.pdf` or
`thumbnails/patientId/uuid-filename.pdf.jpg`). Query params:

| Param | Meaning |
|---|---|
| `expires` | Unix ms timestamp the URL is valid until |
| `sig` | `HMAC-SHA256(secret, "key:expires")`, hex-encoded |

`200` streams the file with the correct `Content-Type` inferred from the file
extension. `403 FORBIDDEN` if the signature is missing, malformed, or expired.
`404 NOT_FOUND` if the key doesn't resolve to a real file (also returned for a
path-traversal attempt, rather than leaking a distinct error).

You never construct these URLs by hand — they're returned as `downloadUrl` /
`thumbnailUrl` on the relevant `User`/`MedicalRecord` responses above, always
freshly signed with a **15-minute** TTL. Don't cache one past that window;
re-fetch the owning resource instead.
