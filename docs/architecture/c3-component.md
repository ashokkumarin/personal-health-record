# C3 — Component

Zooming into the **API Service** container — the piece with all the actual
business logic. The web and mobile containers are UI shells over this API, so
this is the most useful component-level view in the system.

```mermaid
C4Component
  title Component — API Service (apps/api)

  Container_Boundary(api, "API Service (Fastify)") {
    Component(authRoutes, "Auth Routes", "routes/auth.ts", "POST /auth/register, /auth/login, /auth/logout — public, no auth required")
    Component(usersRoutes, "Users Routes", "routes/users.ts", "GET/PATCH /users/me, POST /users/me/password, POST /users/me/photo")
    Component(familiesRoutes, "Families Routes", "routes/families.ts", "Family CRUD, admin promotion, add/remove member (3 add-member modes)")
    Component(approvalsRoutes, "Approvals Routes", "routes/approvals.ts", "List/approve/reject pending patient-link requests")
    Component(recordsRoutes, "Records Routes", "routes/records.ts", "Upload/replace/list/get/update/delete records, /me/timeline, visibility toggle")
    Component(filesRoutes, "Files Route", "routes/files.ts", "GET /files/* — signed download/thumbnail streaming, no auth header")

    Component(authenticate, "authenticate()", "plugins/authenticate.ts", "preHandler hook: verifies Bearer JWT, sets request.userId; 401 UNAUTHENTICATED on failure")
    Component(authUtils, "auth-utils", "auth-utils.ts", "signToken/verifyToken (JWT, 7d expiry), bcrypt password hashing")
    Component(storage, "storage", "storage.ts", "Local filesystem read/write, HMAC-signed URL issuance & verification, path-traversal guard")
    Component(thumbnail, "thumbnail", "thumbnail.ts", "sharp for image thumbnails, poppler pdftoppm for PDF page-1 thumbnails; never throws")
    Component(ocr, "OCR extraction", "ocr.ts", "Async text extraction from uploads, feeds the records keyword search")
    Component(prisma, "Prisma Client", "generated", "Typed DB access layer")
  }

  ContainerDb(db, "PostgreSQL")
  ContainerDb(media, "Media Storage (filesystem)")

  Rel(usersRoutes, authenticate, "protected by")
  Rel(familiesRoutes, authenticate, "protected by")
  Rel(approvalsRoutes, authenticate, "protected by")
  Rel(recordsRoutes, authenticate, "protected by")

  Rel(authRoutes, authUtils, "issues JWTs via")
  Rel(authenticate, authUtils, "verifies JWTs via")
  Rel(usersRoutes, authUtils, "verifies current password via")

  Rel(recordsRoutes, storage, "stores/deletes originals, gets signed download URLs")
  Rel(recordsRoutes, thumbnail, "generates thumbnail on upload/replace")
  Rel(recordsRoutes, ocr, "fires-and-forgets text extraction on upload/replace")
  Rel(usersRoutes, storage, "stores avatar, gets signed URL")
  Rel(filesRoutes, storage, "verifies signature, streams file")

  Rel(authRoutes, prisma, "")
  Rel(usersRoutes, prisma, "")
  Rel(familiesRoutes, prisma, "")
  Rel(approvalsRoutes, prisma, "")
  Rel(recordsRoutes, prisma, "")
  Rel(prisma, db, "SQL")
  Rel(storage, media, "file I/O")
  Rel(thumbnail, media, "writes generated thumbnail via storage")

  UpdateLayoutConfig("landscape")
```

## Component notes

### `authenticate()` is plugin-scoped, not global
It's added via `app.addHook("preHandler", authenticate)` inside each protected
route file individually (`users.ts`, `families.ts`, `approvals.ts`,
`records.ts`) rather than once in `app.ts`. `auth.ts` (registration/login) and
`files.ts` (signed downloads) deliberately never register it — those two are
the only genuinely public routes in the system.

### `filesRoutes` doesn't use JWT auth at all
`GET /files/*` is gated by an HMAC signature (`expires` + `sig` query params,
verified with a constant-time comparison) rather than a bearer token. This is
intentional: `downloadUrl`/`thumbnailUrl` values are handed to browsers/WebViews
as plain URLs (in `<img>` tags, `<iframe>`s, native `Image` components) which
can't attach an `Authorization` header. The signature is time-limited to 15
minutes (`URL_TTL_MS` in `storage.ts`) so a leaked URL has a short blast radius.
See [API reference → Files](../api-reference.md#files) and
[Backend service → Signed URLs](../apps/backend-service.md#signed-file-urls).

### Thumbnail generation is synchronous; OCR is not
`recordsRoutes` calls `thumbnail.ts` **synchronously** before responding (the
client needs `thumbnailUrl` in the upload response for the timeline grid to
render immediately). OCR text extraction, by contrast, is fired-and-forgotten
after the response is sent — `ocrText` gets backfilled onto the record a moment
later, which is why keyword search (`GET /families/:familyId/records?q=...`)
can occasionally miss a just-uploaded document for a second or two.

### Authorization logic lives in `records.ts`, not in a shared middleware
Because "can I see/edit this record" depends on three different concepts —
family membership, patient-visibility (`visibleToFamily` + "is this your own
linked patient"), and record ownership — the checks (`isFamilyMember`,
`isRecordVisible`, `canManageRecord`) are plain functions inside `records.ts`
rather than generic Fastify hooks. See
[Data model → Authorization model](../data-model.md#authorization-model) for
the full rule set.
