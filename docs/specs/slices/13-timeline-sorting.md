# Slice 13: Timeline Sorting

Implements Story 13 (mvp-spec.md). Before this slice, both apps always showed records newest-first with no user control. This slice adds an explicit sort control; the underlying date grouping (by month in grid view, by day in mobile's vertical list view) is unaffected — only the direction changes, which is why the sort options are date-based only (see "Explicitly Deferred").

## 1. Acceptance Criteria

1. Given a timeline (grid or list view, either app), when the user opens the sort control, then they can choose "Newest first" (default) or "Oldest first".
2. Given a sort order is chosen, then the displayed records reorder accordingly, and the date/month grouping headers remain contiguous (no group split across non-adjacent positions).
3. Given mobile specifically, when the user opens a record from a sorted timeline and swipes to the next/previous one, then the swipe order matches the currently-selected sort order, not a hardcoded one.
4. Given the sort control, then the currently-active option is visibly indicated (checkmark) when the menu is reopened.

## 2. Explicitly Deferred

- Sorting by title or document type — considered and deliberately dropped: both timeline views are structurally date-grouped (month headers on grid, date rail on mobile's list view), and a title sort would scatter same-month/same-day records into non-contiguous groups, breaking the grouped layout. Date-direction-only sorting was judged the right scope for this release; a title/type sort would need a flat (non-grouped) view mode to look coherent, which is out of scope here.
- Persisting the chosen sort order across sessions — resets to "Newest first" on next visit/app launch (the existing "default timeline view" grid/list *display mode* setting in Appearance is unrelated and unaffected).

## 3. Tasks

1. `apps/mobile/components/RecordList.tsx`: `SortOption` type (`"date-desc" | "date-asc"`), `SORT_OPTION_LABELS`, and `sortRecordsForTimeline(records, sortOption)` (previously hardcoded to descending only) now takes the option as a parameter.
2. `apps/mobile/screens/TimelineScreen.tsx` and `FamilyTimelineScreen.tsx`: sort-order state, a sort icon button (Menu, react-native-paper) placed next to the existing grid/list view toggle; sort order threaded into both `RecordList` (for display) and the record-ID list built for `RecordViewer` navigation (so swipe order matches).
3. `apps/web/app/components/RecordGrid.tsx`: equivalent `SortOption`/`sortRecords()`; a sort `Button`+`Menu` added to the existing selection toolbar row; the month-grouping `useMemo` and the list view's "default to first document" effect both re-derived from the sorted array instead of the raw `records` prop.

## 4. Test List

No automated tests — 100% client-side sorting of data already returned by existing, already-tested API endpoints; no API surface changed. Verified manually:
- Switching sort order on both apps re-groups records correctly with no split/scattered groups.
- On mobile, opening a record after switching sort order and swiping traverses records in the new order, not the previous one.
- The active sort option is checked/highlighted when reopening the menu.

## 5. Definition of Done

- `apps/mobile` and `apps/web` typecheck.
- Manually verified per the test list on Android, iOS, and a desktop browser.
- Existing grid/list view-mode toggle and multi-select behavior (Slice 12) continue to work unchanged alongside the new sort control.
