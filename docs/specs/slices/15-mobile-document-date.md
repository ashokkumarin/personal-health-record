# Slice 15: Mobile Document Date on Upload

Brings mobile's Upload screen (`apps/mobile/screens/UploadScreen.tsx`) up to parity with
`apps/web`'s upload form (`apps/web/app/families/[id]/page.tsx`), which already lets a user
set/edit a document's date (`capturedAt`) at upload time. Mobile's `UploadScreen` currently
collects patient, document type, title, and file, but never surfaces `capturedAt` — every
mobile upload silently falls back to `uploadedAt` for display/sort ordering. The API
(`POST /patients/:patientId/records`), the shared schema (`uploadRecordFieldsSchema` in
`packages/shared/src/records.ts`), and mobile's local data layer (`createLocalRecord` in
`apps/mobile/lib/data/records.ts`) already accept and persist `capturedAt` — this slice is
UI-only.

## 1. Acceptance Criteria

1. Given the mobile Upload screen, when it first renders, then a "Document date" field is
   shown, defaulting to today's date — matching web's default (`todayDateInputValue()`
   equivalent).
2. Given the Document date field, when the user taps it, then a native date picker opens
   (`@react-native-community/datetimepicker`, already a mobile dependency and already used
   for this exact purpose in `ProfileScreen.tsx`'s date-of-birth field): `DateTimePickerAndroid.open()`
   on Android, an inline modal `DateTimePicker` on iOS.
3. Given the date picker, then future dates are disabled (`maximumDate: new Date()`),
   matching web's `max={todayDateInputValue()}` constraint on the `<input type="date">`.
4. Given a user selects a date and completes the upload, then the created record's
   `capturedAt` is set to the selected date (passed through to `createLocalRecord`'s
   `fields.capturedAt`, which already writes it to the local `captured_at` column and queues
   it in the sync mutation payload — no data-layer change needed).
5. Given a user does not interact with the date field at all, then the upload still succeeds
   using the pre-filled default (today), so this is a strict addition — no existing upload
   flow behavior regresses.
6. Given a completed upload, when the new record appears in the mobile timeline
   (`RecordList.tsx`), then it sorts and displays by the chosen `capturedAt` date, not
   `uploadedAt` — this already works today for any record with `capturedAt` set (see
   `RecordList.tsx` lines 37-44) and is confirmed end-to-end by this slice.

## 2. Explicitly Deferred

- Editing the date (or any other field) of an *already-uploaded* record on mobile — mobile
  has no record-edit UI at all yet (web's `RecordGrid.tsx` edit dialog has no mobile
  equivalent). That is a separate, larger parity gap tracked outside this slice.
- Any change to `apps/web` — web already has this behavior; it is the reference.
- Any change to `apps/api` or `packages/shared` — `capturedAt` is already a fully supported
  field end-to-end; only the mobile Upload screen UI is missing it.

## 3. Tasks

1. `apps/mobile/screens/UploadScreen.tsx`: add `capturedAt` state, initialized to today
   (`new Date().toISOString().slice(0, 10)`).
2. Add a "Document date" pressable field (react-native-paper `TextInput` with `editable={false}`
   plus an `onPress`/icon, or a `Button`, matching the visual style already used elsewhere in
   this screen) that opens the picker.
3. Wire the Android/iOS picker branches exactly as `ProfileScreen.tsx` does for date of birth,
   with `maximumDate: new Date()` instead of `maximumDate: new Date()` used for DOB (same cap,
   different semantic reason — no future document dates).
4. Pass `capturedAt` through in the `createLocalRecord(user.id, selectedPatientId, { recordType, title, capturedAt }, ...)` call.
5. Manual verification (no automated UI test harness exists for mobile screens in this repo).

## 4. Test List (written before implementation)

No automated tests — consistent with how `apps/mobile` UI-only screens are verified elsewhere
in this repo (e.g. Slice 10's test list). Verified manually against a running Expo session on
both Android and iOS:

- Upload screen loads with "Document date" pre-filled to today.
- Tapping the field opens the native picker on both platforms; picking a past date updates the
  field; the picker will not allow selecting a future date.
- Uploading with the default (untouched) date succeeds and the record's date shown in the
  timeline matches today.
- Uploading with a manually-changed past date succeeds and the record sorts/displays under
  that date in the timeline (`RecordList.tsx`), not the upload date.

## 5. Definition of Done

- `apps/mobile` typechecks (`npx tsc --noEmit`).
- Manually confirmed on a real device/emulator per the test list above.
- No regression to the existing patient/type/title/file parts of the Upload flow.
