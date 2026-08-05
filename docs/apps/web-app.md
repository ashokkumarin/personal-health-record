# Web App (`apps/web`)

Next.js 14, App Router, MUI, all pages client components (`"use client"`) —
there's no server-rendered data fetching; every page fetches from the API in
`useEffect` after mount and gates itself on `getToken()`.

## Pages

| Route | File | Purpose |
|---|---|---|
| `/` | `app/page.tsx` | Logged out: marketing splash. Logged in: the caller's own timeline (`GET /me/timeline`), grid/list toggle, filters, upload dialog |
| `/login`, `/register` | `app/login/`, `app/register/` | Auth forms. Login also has a "Forgot password?" dialog — see below |
| `/change-password` | `app/change-password/page.tsx` | Forced password change (see below) |
| `/admin` | `app/admin/page.tsx` | Admin-only: Users, Password Reset Requests, Audit Log — see below |
| `/families/[id]` | `app/families/[id]/page.tsx` | Family detail — members, add-member (3 modes), documents tab; rename/delete for managers |
| `/families/[id]/timeline` | `app/families/[id]/timeline/page.tsx` | Family-scoped timeline, optional `?patientId=` (set when clicking a patient in the sidebar tree) |
| `/profile` | `app/profile/page.tsx` | Personal info (incl. avatar upload) + change password |
| `/settings` | `app/settings/page.tsx` | Family Groups (`FamilyGroupsSection`) + Appearance (`AppearanceSection`) |
| `/approvals` | `app/approvals/page.tsx` | Pending patient-link approval requests |
| `/api/[...path]` | `app/api/[...path]/route.ts` | Server-side proxy to the API (see below) |

## Session & auth

`lib/auth.ts` — the whole session lives in `localStorage`:
```ts
getToken(): string | null
getCurrentUser(): User | null
setSession(user, token)      // login/register success
updateStoredUser(user)       // after any profile-mutating call
clearSession()                // logout
```
Every mutation fires a `phr-session-changed` window event
(`SESSION_CHANGED_EVENT`) so `Nav` (which lives in the root layout and never
remounts on client-side navigation) and `ThemeRegistry` can react without prop
drilling. There is **no cookie, no server session, no middleware-based route
guarding** — each page checks `getToken()` itself in a `useEffect` and
redirects to `/login` if absent. `Nav` renders `null` entirely when logged out.

Logout does a **hard navigation** (`window.location.href = "/login"`), not a
router push — deliberately, so every page component remounts fresh rather than
reusing state from the previous session (relevant if a different user logs in
on the same device right after).

## Admin, forced password change, and forgot password

There's no email/SMTP infra in this app, so "forgot password" doesn't send
anything — the dialog on `/login` calls `POST /auth/forgot-password`
(always shows the same generic success message, to avoid leaking which
emails are registered) and an admin resolves it from `/admin` → Password
Reset Requests.

`Nav.tsx`'s existing per-route-change effect (the one that re-reads the
session on navigation) doubles as the forced-password-change gate: if
`getCurrentUser()?.mustChangePassword` is true and the current path isn't
already `/change-password`, it redirects there. This is the one place every
authenticated page passes through, so it's the natural choke point — there's
still no middleware-based route guarding (see Session & auth above).

`/admin` is client-gated the same way every other page gates on
`getToken()`, plus a check on `getCurrentUser()?.isAdmin` (redirects to `/`
if false — this is **not** a security boundary, just UX; the real check is
server-side `requireAdmin` on every `/admin/*` route). `Nav.tsx`'s avatar menu
only shows the "Admin" item when `isAdmin` is true. See
[API reference → Admin](../api-reference.md#admin) for the full route list
the three `/admin` sections (`UsersSection`, `PasswordResetRequestsSection`,
`AuditLogSection`) call through `adminClient()` (`lib/api.ts`).

## The `/api/[...path]` proxy

`lib/api.ts` builds every API client against `NEXT_PUBLIC_API_URL ??  "/api"`
— i.e. by default, all JSON calls go through this same-origin Next.js route
handler, which forwards to `API_INTERNAL_URL` server-side (copying every
header except `host`/`content-length`/`expect`, including `Authorization`).
See [C2 — Container](../architecture/c2-container.md#why-the-web-app-has-a-proxy-and-the-mobile-app-doesnt)
for why.

**This proxy is bypassed for file downloads.** `downloadUrl`/`thumbnailUrl` are
absolute URLs pointing directly at `API_PUBLIC_URL` (see
[API reference → Files](../api-reference.md#files)), fetched straight from the
browser — `<img src>`, `<iframe src>` for PDF preview, plain `<a href download>`
for the download button.

## Theming — the "banner color" system

`lib/theme.ts` defines `DEFAULT_BANNER_COLOR` and 8 `BANNER_COLOR_PRESETS`.
`createAppTheme(bannerColor)` sets MUI's `palette.primary.main` to it — this
single value drives the `AppBar`, buttons, and icons app-wide via MUI's
automatic `contrastText` computation.

`ThemeRegistry.tsx` (in the root layout, wraps every page) resolves the color
with this precedence: **logged-in user's `themeColor` field** (server-backed,
follows the account across devices) → **`localStorage` cache**
(`phr:bannerColor`, so there's something to paint before the user object loads,
and so it still works on the logged-out `/login` page) → the default teal.
`AppearanceSection` (Settings) is the only place that writes both: it saves to
the server via `userClient().updateProfile({ themeColor })` and calls
`setStoredBannerColor()` for instant local feedback while that request is
in flight, firing `phr:theme-changed` so `ThemeRegistry` re-themes live.

## Key components

- **`Nav.tsx`** — sticky `AppBar`: hamburger (opens `Sidebar`), logo, approvals
  bell (badge count from `familyClient().listApprovals()`), avatar dropdown
  (Profile / Settings / Log out).
- **`Sidebar.tsx`** — the hamburger drawer. On open, fetches
  `listFamilies()` then `getFamily()` for each (parallel) and renders an MUI
  X `SimpleTreeView`: family → patients, all expanded by default. Clicking a
  family goes to its detail page; clicking a patient goes straight to that
  family's timeline pre-filtered to them.
- **`RecordGrid.tsx`** — shared by the home timeline and the family timeline
  page. Two view modes:
  - **Grid**: records grouped by month, MUI `ImageList` of thumbnails, click
    opens a preview `Dialog` (`<img>` for images, `<iframe>` for PDFs — the
    browser's native PDF viewer, no extra library needed here since it's a
    real browser, not a mobile WebView).
  - **List**: month-grouped list in a sidebar `Card` + a preview pane beside
    it, auto-selecting the first document.
  - **Multi-select**: a "Select" toggle reveals checkboxes on every
    thumbnail/row; a selection toolbar shows count + Download (fetches each
    file as a blob and triggers a sequential browser download, reporting
    progress) + Cancel.
- **`PageBreadcrumbs.tsx`** — small breadcrumb trail used on family/timeline
  pages.

## Local dev

```
npm run dev:web     # from repo root — next dev, port from NEXT_PUBLIC env
```
Requires the API running and reachable at whatever `NEXT_PUBLIC_API_URL`/proxy
target you've configured — see [Deployment](../deployment.md) for the env vars.
