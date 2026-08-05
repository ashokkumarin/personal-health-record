# Backend Service (`apps/api`)

Fastify + Prisma + PostgreSQL, TypeScript, single stateless process. For the
route-by-route contract, see [API Reference](API-Reference); this page
covers how the pieces underneath those routes actually work.

## Request lifecycle

```
Fastify instance (app.ts)
 ├─ @fastify/cors — origin: [WEB_ORIGIN, "https://mozilla.github.io"]
 ├─ authRoutes            (public)
 ├─ familiesRoutes         ─┐
 ├─ approvalsRoutes         │ each registers its own
 ├─ recordsRoutes           │ authenticate preHandler hook
 ├─ usersRoutes             │ (see below)
 ├─ syncRoutes              │
 ├─ auditSyncRoutes        ─┘
 ├─ adminRoutes            (authenticate + requireAdmin — see below)
 └─ filesRoutes            (public — signature-gated instead)
```

`logger: false` — there's no request logging or structured logging anywhere in
this service. No `helmet`, no rate limiting, no global error handler beyond
Fastify's defaults. `@fastify/multipart` is registered **per route group**
(inside `usersRoutes` for avatar upload, 5 MB limit; inside `recordsRoutes` for
record upload/replace, 25 MB limit) rather than globally — routes that don't
handle file uploads never pay for multipart parsing setup.

## Auth

`plugins/authenticate.ts` is a Fastify `preHandler` hook, not a global plugin —
it's added via `app.addHook("preHandler", authenticate)` individually inside
`users.ts`, `families.ts`, `approvals.ts`, and `records.ts`. It:

1. Reads `Authorization: Bearer <token>`.
2. `jwt.verify(token, JWT_SECRET)` (via `verifyToken` in `auth-utils.ts`).
3. On success, sets `request.userId = payload.sub` (a Fastify module
   augmentation adds this field to the request type).
4. On any failure (missing header, bad/expired token) — `401 UNAUTHENTICATED`.

Tokens are issued by `signToken(user)` in `auth-utils.ts`:
`jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" })`.
**There is no refresh-token flow** — a client just prompts re-login once a
token expires. Passwords are hashed with `bcrypt` (cost factor 10) on register
and re-verified on login/password-change; the hash never leaves `auth-utils.ts`.

### Admin (`plugins/requireAdmin.ts`)

Stacked *after* `authenticate` on `adminRoutes` (`app.addHook("preHandler",
authenticate)` then `app.addHook("preHandler", requireAdmin)` — both hooks run
in registration order). Unlike the JWT-only `authenticate` check,
`requireAdmin` does a **database** lookup of `User.isAdmin` on every request
rather than trusting a claim baked into the token — deliberately, so revoking
someone's admin access takes effect on their very next request instead of
waiting out the token's 7-day expiry. Non-admins (and soft-deleted users) get
`403 FORBIDDEN`.

The first admin account is created idempotently on every boot by
`bootstrap.ts`'s `ensureAdminUser()` (called from `server.ts`, **not** from
`buildApp()` — so it never runs against the test database) from
`ADMIN_EMAIL`/`ADMIN_PASSWORD`. See [API reference → Admin](API-Reference#admin)
for the route list and
[Data model → System admin](Data-Model#system-admin-userisadmin-vs-familyrole)
for the cascading-delete semantics.

## File storage

`storage.ts` — everything lives on a local filesystem, at `MEDIA_ROOT`
(default `<cwd>/media`, mounted as the `phr-media` Docker volume in
production — see [Deployment](Deployment)). There is no S3/cloud storage
backend in this codebase.

```ts
uploadObject(key, buffer)         // writes MEDIA_ROOT/<key>, creates parent dirs
deleteObject(key)                 // unlinks; ENOENT is not an error
resolveMediaPath(key)             // path.resolve + a path-traversal guard
contentTypeForKey(key)            // extension → MIME lookup, defaults to octet-stream
```

`resolveMediaPath` is the one thing here worth reading carefully: it resolves
`key` against `MEDIA_ROOT` and then verifies the result is *inside*
`MEDIA_ROOT` (equal to it, or starts with `MEDIA_ROOT + path.sep`) before
returning — the only defense against a `key` like `../../etc/passwd` reaching
the filesystem. Every caller (`files.ts`, record upload/delete) goes through
this function; there is no other path-safety check anywhere else in the
codebase, so if you ever add a new file-serving route, route it through here.

### Signed file URLs

Files aren't served behind the JWT auth used everywhere else — they're handed
out as **pre-signed URLs** instead, because the consumers are `<img>` tags,
`<iframe>`s, and native `Image`/`WebView` components, none of which can attach
an `Authorization` header.

```ts
getSignedDownloadUrl(key)
// expires = Date.now() + 15 minutes
// sig     = HMAC-SHA256(SIGNING_SECRET, `${key}:${expires}`)
// → `${API_PUBLIC_URL}/files/${encodedKey}?expires=${expires}&sig=${sig}`
```
`SIGNING_SECRET` is `FILE_SIGNING_SECRET` if set, else it **falls back to
`JWT_SECRET`** — fine for a single-service deployment, but worth knowing if you
ever split file-serving into its own service (you'd want to set
`FILE_SIGNING_SECRET` explicitly then, so rotating one secret doesn't silently
rotate the other).

`GET /files/*` (`files.ts`) verifies with `timingSafeEqual` (constant-time, to
avoid a timing side-channel on the signature check) and rejects anything past
its 15-minute `expires`. **These URLs are minted fresh on every relevant
response** — list endpoints only ever include `thumbnailUrl`; `downloadUrl` is
added only on `GET /records/:id`, specifically so a client can't hold onto a
stale signed URL from a list response and expect it to keep working. Every
consumer (web's `RecordGrid.openPreview()`, mobile's `RecordViewerScreen`)
re-fetches the single record right before displaying it, for exactly this
reason.

## Thumbnails

`thumbnail.ts` — `generateThumbnail(buffer, mimeType)` **never throws**; a
failure just results in `thumbnailPath: null` on the record, not a failed
upload. Runs **synchronously**, inline in the upload/replace request, because
the client needs `thumbnailUrl` in that same response to render the grid
immediately.

- `image/jpeg` / `image/png` → `sharp`, resized to fit inside 300×300, JPEG
  quality 80.
- `application/pdf` → shells out to poppler's `pdftoppm` CLI on page 1 only
  (`-f 1 -l 1 -scale-to 300 -singlefile -jpeg`), via a temp directory that's
  always cleaned up. The code comment here is worth repeating: **poppler was
  chosen over `pdfjs-dist` + `canvas` because that combination rendered blank
  pages for PDFs with embedded fonts** — `pdfjs-dist` couldn't load the fonts
  from memory the way poppler's own font handling can. This is why the API's
  Docker image installs `poppler-utils` as a system package
  (`apps/api/Dockerfile`) rather than relying on an npm dependency alone.
- Anything else → `null`, no thumbnail.

Thumbnails are stored at `thumbnails/<original key>.jpg` — same path shape as
the original, just prefixed and always re-encoded as JPEG regardless of source
type.

## OCR / keyword search

A `MedicalRecord`'s `ocrText` field is populated **asynchronously** — extraction
is fired off after the upload/replace response has already been sent, and
errors are swallowed (a failed extraction just leaves `ocrText: null`, it
never fails the upload). This means:
- A just-uploaded document may not show up in a keyword search
  (`GET /families/:familyId/records?q=...`, which matches against both `title`
  and `ocrText`, case-insensitive) for a second or two.
- Replacing a record's file (`PUT /records/:id/file`) explicitly **clears**
  `ocrText` before re-extracting — so a search that was matching the old
  content briefly won't, until the new extraction lands.

## Environment variables

| Variable | Default | Used by |
|---|---|---|
| `DATABASE_URL` | *(required)* | Prisma — PostgreSQL connection string |
| `JWT_SECRET` | `"dev-only-change-me"` | Auth token signing; also the fallback file-signing secret |
| `FILE_SIGNING_SECRET` | falls back to `JWT_SECRET` | HMAC secret for signed `/files/*` URLs |
| `MEDIA_ROOT` | `<cwd>/media` | Root directory for all uploaded files/thumbnails/avatars |
| `API_PUBLIC_URL` | `http://localhost:4000` | Base URL baked into every signed download URL — **must be how clients actually reach the API**, not an internal Docker hostname |
| `API_PORT` | `4000` | Port the server binds (`0.0.0.0`) |
| `WEB_ORIGIN` | `http://localhost:3000` | Allowed CORS origin for the web app (the `mozilla.github.io` pdf.js origin is hardcoded alongside it, not env-controlled) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | *(unset — logs a warning and skips bootstrap)* | Account upserted with `isAdmin: true` on every boot — see Admin above |

Set these for real in production — the `"dev-only-change-me"` fallback for
`JWT_SECRET` is exactly what it sounds like.

## Boot sequence

`server.ts`: `ensureMediaRoot()` (creates `MEDIA_ROOT` if missing — logs and
continues rather than crashing on failure) → `ensureAdminUser()` (logs and
continues on failure, same reasoning) → `buildApp().listen({ port, host:
"0.0.0.0" })`. A listen failure logs and calls `process.exit(1)`.
