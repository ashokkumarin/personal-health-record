# Slice 11: Document Viewing, Swipe Navigation & Download

Implements Stories 10 and 11 (mvp-spec.md). Mobile had no way to open a record's actual file at all before this slice — only thumbnails. This slice adds a dedicated viewer screen on mobile (images inline, PDFs via the device's native viewer), swipe-to-next/previous between records, and a download action on both apps.

The PDF approach went through two failed attempts before landing on the current one — documented here because the failure modes are non-obvious and worth knowing before "fixing" this again:
1. **An in-app WebView pointed at the raw PDF** rendered blank on Android — the embedded WebView component has no built-in PDF renderer at all (that's a Chrome-the-app feature, not exposed to apps that embed a WebView).
2. **pdf.js's hosted viewer page loaded in the WebView** rendered the toolbar but not the PDF content, because the viewer page is `https://` and the local-dev API is plain `http://` — the browser's mixed-content policy silently blocks that fetch, and iOS's WKWebView has no override for it (Android's `mixedContentMode="always"` fixed Android only).

The shipped approach downloads the file locally, then hands it to the OS's native "open with" chooser (`expo-sharing`) — no in-app rendering, no CORS/mixed-content surface at all, works offline once downloaded.

## 1. Acceptance Criteria

1. Given a record in a mobile timeline (grid or list), when the user taps it, then a viewer screen opens showing the image inline, or — for a PDF — a placeholder with the document's title and an Open/Download action.
2. Given the viewer screen is open, when the user swipes left, then the next record (in the current sort order) is shown; swiping right shows the previous one. Swiping past the last record while on the last, or past the first while on the first, has no effect.
3. Given the viewer screen, when a new record becomes current (initial open or after a swipe), then the header title updates to that record's title.
4. Given either app, when the user chooses to download a document, then the file is saved to the device (mobile: via the native share/save sheet; web: via a normal browser download).
5. Given a PDF specifically, when the user chooses to open/download it, then it opens in a native PDF-capable app rather than failing or showing a blank screen.

## 2. Explicitly Deferred

- In-app pinch-to-zoom or annotation on images — out of scope.
- An in-app PDF renderer (e.g. bundling `pdf.js` as a local asset) — deferred; the native-open approach was judged sufficient and meaningfully more reliable for this release.

## 3. Tasks

1. `apps/mobile/screens/RecordViewerScreen.tsx`: route params carry the full ordered list of record IDs plus a starting index (not just one record), so swipe can move through the set without re-fetching the list.
2. Swipe gesture: `PanResponder` (horizontal-dominant threshold), `goPrev`/`goNext` clamped at the array bounds.
3. Header title kept in sync via `navigation.setOptions({ title })` as the current record changes.
4. `apps/mobile/lib/download.ts`: `downloadRecordFile()` (fetches a fresh signed `downloadUrl` via `GET /records/:id`, downloads to local cache via `expo-file-system`'s `File.downloadFileAsync`) and `downloadAndShareRecord()` (downloads then `expo-sharing.shareAsync()`).
5. Added a Download action to the viewer screen's header (`TopBanner`'s new `headerRight` slot) and to the PDF placeholder card.
6. `apps/web`: reused the existing preview dialog (`RecordGrid.tsx`) for images/PDFs (browser-native `<iframe>` renders PDFs directly, no equivalent problem to solve there); added a Download button next to it using the record's signed `downloadUrl`.

## 4. Test List

No automated tests — client-only change, no API surface change (`GET /records/:id`, used to fetch a fresh `downloadUrl`, already existed and is covered by Slice 3/7's tests). Verified manually:
- Opening an image record from both grid and list view shows it inline; swiping moves through records in the currently-active sort order and stops correctly at both ends.
- Opening a PDF shows the placeholder and opens correctly in a native viewer via the Open/Download action, on both Android and iOS.
- The header title updates on swipe.
- Download works from the mobile viewer and from web's preview dialog.

## 5. Definition of Done

- `apps/mobile` and `apps/web` typecheck.
- Manually verified per the test list on Android, iOS, and a desktop browser.
- No regression to the underlying `GET /records/:id` authorization rules (visibility/family-membership checks unchanged — this slice is purely a client-side consumer of that existing endpoint).
