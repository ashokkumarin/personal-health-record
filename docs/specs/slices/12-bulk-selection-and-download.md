# Slice 12: Bulk Selection & Download

Implements Story 12 (mvp-spec.md). Depends on Slice 11's single-record download helper on mobile and the signed-download-URL flow on web — this slice is the multi-record wrapper around both.

## 1. Acceptance Criteria

1. Given a timeline (grid or list view, either app), when the user enters selection mode, then each record shows a selectable checkbox/badge instead of (or in addition to) opening the viewer on tap.
2. Given selection mode is active, when the user taps/clicks additional records, then each toggles independently in/out of the selection, and a running count of selected records is shown.
3. Given at least one record is selected, when the user chooses Download, then every selected record is downloaded; the control is disabled when nothing is selected.
4. Given a bulk download in progress, then the user sees progress (web: "Downloading X/N…"; mobile: a loading state on the download action).
5. Given a bulk download where some files fail to download, then the failures are reported by count (e.g. "Could not download 2 of 5 document(s)") rather than the whole operation silently failing or aborting the remaining files.
6. Given the user chooses Cancel while in selection mode, then the selection is cleared and the timeline returns to its normal tap-to-view behavior.
7. Given mobile specifically, when the user long-presses a record while not already in selection mode, then selection mode is entered with that record pre-selected (mobile has no hover state, so this replaces web's explicit "Select" button as the entry point).

## 2. Explicitly Deferred

- A single combined archive (zip) download for multiple files — both apps download/share files one at a time in sequence; mobile's OS share sheet in particular has no multi-file API to build on for this release.
- Selecting *all* records in one action (no "select all" shortcut) — deferred.

## 3. Tasks

1. `apps/web/app/components/RecordGrid.tsx`: `selectionMode`/`selectedIds` state; checkboxes overlaid on grid thumbnails and prefixed on list rows; a selection toolbar (count, Download, Cancel) replacing the default "Select" button; bulk download fetches each selected record's fresh `downloadUrl` then triggers a blob-based browser download per file, sequentially, tracking progress and failures.
2. `apps/mobile/components/RecordList.tsx`: `selectionMode`/`selectedIds`/`onToggleSelect`/`onLongPressRecord` props threaded through both the grid and vertical-timeline render paths; a `SelectionBadge` overlay.
3. `apps/mobile/components/SelectionBar.tsx`: the count/Cancel/Download header row, shared by both timeline screens.
4. `apps/mobile/lib/download.ts`: `downloadAndShareAll()` — walks the selection, calling the Slice 11 single-download-and-share helper for each and reporting which ones failed.
5. Wired into both `TimelineScreen.tsx` and `FamilyTimelineScreen.tsx` on mobile, and both the home and family timeline pages on web.

## 4. Test List

No automated tests — client-only feature, no new/changed API routes (bulk download re-fetches `GET /records/:id` per file, same authorized endpoint used everywhere else). Verified manually:
- Entering selection mode (Select button on web, long-press on mobile), selecting/deselecting several records, and confirming the count updates correctly.
- Bulk-downloading a mixed selection of images and PDFs succeeds on both apps.
- Simulating a failure (e.g. a record deleted mid-selection) surfaces the correct "N of M failed" message rather than crashing or silently dropping it.
- Cancel clears selection and restores normal tap-to-view behavior.

## 5. Definition of Done

- `apps/mobile` and `apps/web` typecheck.
- Manually verified per the test list on Android, iOS, and a desktop browser.
- Selection state does not leak between screens (navigating away and back starts with an empty selection).
