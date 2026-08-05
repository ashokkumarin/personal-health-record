# Mobile App (`apps/mobile`)

Expo-managed React Native app, `react-native-paper` (Material Design 3) for
UI, React Navigation for routing. Built to mirror the web app's structure and
features, with a few deliberate divergences forced by mobile platform
constraints — documented below.

## Navigation shell

```
App.tsx
 └─ GestureHandlerRootView
     └─ SafeAreaProvider
         └─ AuthProvider (lib/authContext.tsx)
             └─ PaperProvider (theme from lib/theme.ts, keyed on user.themeColor)
                 └─ NavigationContainer
                     └─ RootNavigator (navigation/RootNavigator.tsx)
```

`RootNavigator` reads `useAuth()` and picks one of three things — there's no
route-guarding per screen the way web does it:

- **No token** → `AuthStack` (`Login`/`Register`, no header/chrome).
- **Token present, but `user.mustChangePassword`** → `ChangePasswordScreen`,
  full-screen and blocking (no drawer/tabs) — set when an admin creates the
  account or resets its password. Clearing the flag (a successful
  `POST /users/me/password`) is the only way out; see
  [API reference → Users](API-Reference#users).
- **Token present, password OK** → `AppDrawer` — a `createDrawerNavigator`
  whose single screen is `AppStack` (a `createNativeStackNavigator` holding
  every real screen: `Timeline`, `FamilyDetail`, `FamilyTimeline`, `Upload`,
  `Settings`, `Profile`, `RecordViewer`). Every screen in `AppStack` shares one
  custom header component, `TopBanner`.

**`Timeline` is the initial route** — matching web, your own linked-patient
timeline (`GET /me/timeline`) is the landing screen after login, not a family
list.

## Session persistence

`lib/authContext.tsx` — unlike web (which just reads `localStorage`
synchronously), mobile has to hydrate from `AsyncStorage` asynchronously on
boot, so `RootNavigator` shows a spinner (`loading` state) until that resolves.
`login()`/`logout()`/`setUser()` all write through to `AsyncStorage`
immediately so a relaunch always reflects the latest session without an extra
network round-trip.

`lib/useApi.ts` — a `useApi()` hook returns
`{ familyClient, recordsClient, userClient, adminClient }` from `@phr/shared`,
memoized on the current token; every screen uses this instead of constructing
clients by hand.

## Screens

| Screen | Route | Mirrors (web) |
|---|---|---|
| `TimelineScreen` | `Timeline` | `/` |
| `FamilyDetailScreen` | `FamilyDetail` | `/families/[id]` |
| `FamilyTimelineScreen` | `FamilyTimeline` | `/families/[id]/timeline` |
| `UploadScreen` | `Upload` | the upload dialog on web's timeline pages |
| `SettingsScreen` | `Settings` | `/settings` (Family Groups + Appearance) |
| `ProfileScreen` | `Profile` | `/profile` |
| `AdminScreen` | `Admin` | `/admin` — Users / Password Reset Requests / Audit Log tabs (`SegmentedButtons`, matching `SettingsScreen`'s tab pattern); only reachable from `TopBanner`'s avatar menu when `user.isAdmin` |
| `RecordViewerScreen` | `RecordViewer` | the preview dialog in web's `RecordGrid` |

## `TopBanner` — the shared header

`components/TopBanner.tsx` renders on every `AppStack` screen:
- **Left**: back arrow when `navigation.canGoBack()`, otherwise the hamburger
  (dispatches `DrawerActions.openDrawer()`).
- **Center**: title, resolved as `options.title` (set per-screen via
  `navigation.setOptions`, used for dynamic titles like a patient's name) →
  falling back to a static per-route-name lookup table → `"PHR"`.
- **Right**: `options.headerRight` slot (a general escape hatch mirroring React
  Navigation's own convention — `RecordViewerScreen` uses it for the download
  button) then the avatar → opens a `Menu` with Profile / Settings / Log out.
- The whole bar, and its icon/text colors, are pulled from
  `theme.colors.primary`/`onPrimary` **explicitly** — react-native-paper's MD3
  `Appbar.Header` does *not* default to `primary` the way MUI's `AppBar` does,
  so this has to be set by hand or the "banner color" setting silently has no
  visible effect on the header.

## `DrawerContent` — the hamburger drawer

`components/DrawerContent.tsx` mirrors web's `Sidebar.tsx`: same
`listFamilies()` → `getFamily()` per family fetch pattern, refetched every time
the drawer opens (`useDrawerStatus() === "open"`, not just on mount — otherwise
creating a family in Settings wouldn't show up without a full app restart).
Rendered as `List.Accordion` (family) containing `List.Item`s (patients) — the
closest react-native-paper equivalent to MUI X's `SimpleTreeView`. **Settings
is not in this drawer** — it lives only in the avatar menu, matching web.

## Theming

`lib/theme.ts` duplicates web's `DEFAULT_BANNER_COLOR`/`BANNER_COLOR_PRESETS`
constants (kept as plain data, not routed through `@phr/shared` — there's no
theme module there and 8 hex strings aren't worth a shared dependency).
`createAppTheme(bannerColor)` builds an MD3 theme with `colors.primary` set to
it and `colors.onPrimary` forced to white (safe — every preset is a dark,
saturated color). Both `TopBanner` and every screen's FAB read
`theme.colors.primary`/`onPrimary` explicitly for the same MD3 reason noted
above.

## Records: grid, timeline, and viewing

`components/RecordList.tsx` — the mobile equivalent of web's `RecordGrid.tsx`:
- **Grid view**: thumbnails grouped by month (matching web's grid exactly).
- **List view**: a from-scratch vertical timeline (dots + a continuous rail
  down the left edge, per-date grouping) — a deliberately different, more
  mobile-native take than web's sidebar-list-plus-preview-pane layout, closer
  to a Google Photos-style feed.
- **Multi-select**: long-press any item to enter selection mode (there's no
  hover state on touch, so this replaces web's "Select" button); a header bar
  shows count + Cancel + Download.

`RecordViewerScreen` — tapping a record opens this with the full ordered
record-id list + a starting index (not just one id), so a **swipe
left/right** (via a `PanResponder`, threshold-based, clamped at the ends) moves
to the next/previous record without leaving the viewer. Images render inline
(`<Image>`); the header title updates live via `navigation.setOptions` as you
swipe.

### PDF viewing
Not rendered inline — see below for why. Instead: a placeholder card (PDF
icon + title) with a **Download** button that fetches the file locally and
hands it to the OS share sheet, letting the user open it in whatever
PDF-capable app is installed. This applies to the single-record download
button too (`lib/download.ts`).

> **Why not an in-app WebView, like it briefly was?** Two platform issues,
> found the hard way:
> 1. Android's *embedded* WebView has no built-in PDF renderer — that's a
>    Chrome-the-browser-app feature, not something exposed to apps embedding
>    a WebView component. It just renders blank.
> 2. Loading a PDF through a JS-based renderer (pdf.js's hosted viewer page)
>    works, but its in-page `fetch()` of the file is subject to the browser's
>    mixed-content policy — an `https://` page can't fetch an `http://`
>    resource. That's a non-issue against a production HTTPS API, but breaks
>    against a plain-`http://` local-dev API with no override available on
>    iOS's WKWebView (Android has `mixedContentMode`, iOS doesn't expose
>    an equivalent).
>
> Downloading and handing off to the native viewer sidesteps both problems
> permanently, works offline once downloaded, and — as a bonus — is the same
> mechanism the newly-added Download feature needed anyway.

`lib/download.ts` also exports `downloadAndShareAll()` for bulk downloads —
`expo-sharing` only shares one file per call, so it walks the selection
sequentially, one native share-sheet prompt per file.

## Sync interval

When connected to a server (`ServerConfigProvider`, `lib/serverConfigContext.tsx`),
`SyncProvider` (`lib/sync/syncContext.tsx`) syncs on launch, on every
background→foreground transition, **and** on a `setInterval` timer —
`syncIntervalMinutes * 60_000` ms, default **15**, adjustable in Settings →
Server between **1 and 180** minutes (`screens/settings/ServerSection.tsx`).
The value is clamped and persisted the same way `serverUrl`/`mode` are (a
`sync_interval_minutes` row in the `server_config` KV table). Standalone-mode
devices have no server to sync with, so this setting only appears once
connected.

## Native integrations

| Feature | Package |
|---|---|
| Camera capture / photo library | `expo-image-picker` |
| PDF/document picking (upload flow) | `expo-document-picker` |
| Local file download (records, avatar) | `expo-file-system` (the new `File`/`Paths` API, not the deprecated `FileSystem.downloadAsync`) |
| Native "open with"/save sheet | `expo-sharing` |
| Date-of-birth picker | `@react-native-community/datetimepicker` (native dialog on Android, in-app modal on iOS) |
| PDF fallback rendering | `react-native-webview` (kept as a dependency but only exercised by the abandoned inline-PDF approach above — no longer on the primary path) |

## Local dev

```
npm run dev:mobile          # from repo root — expo start
npx expo start -c           # clear Metro cache after dependency changes
```
`EXPO_PUBLIC_API_URL` (in `apps/mobile/.env`) must point somewhere the device
can actually reach — `localhost` only works for an iOS *simulator* on the same
machine; a real device or Android emulator needs the host's LAN IP (Android
emulators specifically can also use `10.0.2.2`). See
[Deployment](Deployment#environment-variables) for the full variable list.

### A dependency-hoisting gotcha worth knowing about

This is an npm-workspaces monorepo, and mobile's React Native (19.x) and web's
React (18.x) are incompatible major versions living side by side. Getting this
wrong causes exactly the kind of bug that's miserable to diagnose blind: a
runtime crash with no obvious connection to any code you wrote (`Cannot read
properties of undefined` deep in a renderer, or a webpack/SSR crash in an
unrelated app). If you ever see something like that after adding or upgrading
a dependency, check the root `package.json`'s `overrides` block and
[Deployment → dependency hoisting](Deployment#dependency-hoisting-across-two-major-react-versions)
before assuming it's a bug in your change.
