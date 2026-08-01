# Shared Package (`packages/shared`, `@phr/shared`)

A plain TypeScript library — **not a runtime service**. Built once
(`npm run build --workspace packages/shared`, emits to `dist/`) and consumed by
`apps/web`, `apps/mobile`, and (for its zod schemas) `apps/api` as an npm
workspace dependency. This is the single typed contract for the REST API — its
whole purpose is that neither app hand-rolls `fetch()` calls or duplicates
request/response types.

## Modules

| File | Exports |
|---|---|
| `http.ts` | `apiRequest<T>(baseUrl, path, opts)` — the one `fetch()` wrapper everything else builds on; `ApiRequestError` |
| `auth.ts` | `registerSchema`, `loginSchema`, `updateProfileSchema`, `changePasswordSchema` (zod); `User`, `AuthResponse` types; `createAuthClient()`, `createUserClient()` |
| `family.ts` | `createFamilySchema`, `addMemberSchema` (zod, discriminated union on `mode`); `Family`, `FamilyDetail`, `FamilyMembership`, `PatientProfile`, `ApprovalRequest` types; `createFamilyClient()` |
| `records.ts` | `uploadRecordFieldsSchema`, `updateRecordFieldsSchema` (zod); `recordTypes`, `recordTypeLabels`; `MedicalRecord`, `RecordFilters`, `FilePart`, `MyTimeline` types; `createRecordsClient()` |
| `version.ts` | (package version metadata) |

`index.ts` re-exports all of the above — consumers just do
`import { createRecordsClient, type MedicalRecord } from "@phr/shared"`.

## `apiRequest` — the base HTTP layer

```ts
apiRequest<T>(baseUrl, path, { method?, token?, body? }): Promise<T>
```
Adds `Authorization: Bearer <token>` when a token is given, JSON-encodes
`body`, and throws `ApiRequestError(status, body)` on any non-2xx response —
`body` carries the API's `{ error: "SOME_CODE", ... }` shape (see
[API reference → Conventions](../api-reference.md#conventions)), so callers do:
```ts
catch (err) {
  if (err instanceof ApiRequestError && err.body.error === "EMAIL_ALREADY_REGISTERED") { ... }
}
```
instead of parsing status codes by hand. Every `create*Client()` factory below
is a thin object of methods that call `apiRequest` with a fixed `baseUrl`
(and, except for `createAuthClient`, a fixed `token`) already bound in.

## Client factories

```ts
createAuthClient(baseUrl)                    // register, login, logout — no token needed
createUserClient(baseUrl, token)              // getMe, updateProfile, changePassword, uploadPhoto
createFamilyClient(baseUrl, token)            // createFamily, listFamilies, getFamily, renameFamily,
                                               // deleteFamily, promoteAdmin, addMember, removeMember,
                                               // listApprovals, approve, reject
createRecordsClient(baseUrl, token)           // uploadRecord, replaceRecordFile, getRecord, listRecords,
                                               // updateRecord, deleteRecord, setPatientVisibility, getMyTimeline
```
Each method maps 1:1 onto a route in [API Reference](../api-reference.md) —
that page is effectively the documentation for what each client method does;
this page just covers the client layer itself.

### File uploads work identically on web and mobile
`uploadRecord`/`replaceRecordFile`/`uploadPhoto` accept a `FilePart`:
```ts
interface FilePart {
  uri?: string;   // React Native: a local file:// / content:// URI
  blob?: Blob;     // Web: a File/Blob object
  name: string;
  type: string;
}
```
Internally they build a `FormData` and branch on which of `uri`/`blob` is
present — this is the one place platform difference leaks into the shared
layer, and it's contained entirely inside this one function rather than
forcing every call site to know about it.

## Validation schemas double as the source of truth for form logic

`registerSchema`, `loginSchema`, `updateProfileSchema`, `changePasswordSchema`,
`createFamilySchema`, `addMemberSchema`, `uploadRecordFieldsSchema`,
`updateRecordFieldsSchema` are all zod schemas, and both apps run
`schema.safeParse(...)` client-side **before** calling the API — giving
identical validation error messages on web and mobile without duplicating the
rules. The API re-validates independently server-side with the same
`zod` library (see [API reference → Conventions](../api-reference.md#conventions),
`400 VALIDATION_ERROR`) — the shared schemas are a UX nicety (fail fast, same
message everywhere), not the actual security boundary.

## `recordTypeLabels`

```ts
export const recordTypeLabels: Record<RecordType, string> = {
  PRESCRIPTION: "Encounter Notes",
  LAB_REPORT: "Lab Report",
  PHARMACY_BILL: "Pharmacy Bill",
  NOTE: "Note",
};
```
Worth calling out on its own: the **display label** for `PRESCRIPTION` is
"Encounter Notes", not "Prescription" — a wording change made without a data
migration, since the underlying enum value stored in the database and sent
over the wire is unchanged. If you're grepping the codebase for "prescription"
expecting to find UI text, you won't; look for `PRESCRIPTION` instead.

## Adding a new API-backed feature

The established pattern, followed by every existing domain (see
[C4 — Code](../architecture/c4-code.md) for the Records example):
1. Add/extend types and a zod schema here if the feature takes user input.
2. Add the method to the relevant `create*Client()` (or a new factory, if it's
   a new resource).
3. Build (`npm run build --workspace packages/shared`) — both apps' TypeScript
   will now see the new method.
4. Consume it from web and mobile. Neither app should ever construct a
   `fetch()` call to the API directly outside of this package.
