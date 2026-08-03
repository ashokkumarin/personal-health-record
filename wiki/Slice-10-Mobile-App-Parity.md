# Slice 10: Mobile App Navigation Parity

Implements Story 9 ([MVP Spec](MVP-Spec)). Before this slice, `apps/mobile` was a single-file state-machine app (`App.tsx`) with no header, no drawer, no persisted session, and login as the first screen. This slice adds a real navigation shell (React Navigation drawer + native stack), matching web's information architecture: a top banner, a hamburger drawer showing the family/patient tree, a profile menu, and the user's own health record as the landing screen. It also aligned terminology ("Timeline" → "Health Record") across both apps.

## 1. Acceptance Criteria

1. Given a logged-in mobile user, when the app loads, then they land on their own health record (`GET /me/timeline`), not a families list.
2. Given any screen in the app, when the user taps the hamburger icon, then a drawer opens showing their families as expandable sections, each listing its patients; tapping a family opens its detail page, tapping a patient opens that patient's health record.
3. Given the hamburger drawer, when the user looks for a Settings entry, then it is **not** present there — Settings is reached only from the profile menu, matching web.
4. Given any screen, when the user taps the profile/avatar icon, then a menu opens with Profile, Settings, and Log out.
5. Given a screen the user did not land on directly (e.g. Family Detail, Upload, Settings), when they want to go back, then a back arrow is shown in the top banner instead of the hamburger icon.
6. Given the user has set a banner color in Appearance settings, when they view the top banner or a primary action button (e.g. the upload FAB), then it reflects that color.
7. Given any screen showing a timeline heading (home or a family/patient's health record), then the heading and error messages use the term "Health Record", not "Timeline" — matching the same terminology change made on web.
8. Given the app is relaunched after a previous successful login (no explicit logout), then the user is returned straight to their health record without being asked to log in again.

## 2. Explicitly Deferred

- A settings-driven grid/list default is respected on load, but no in-drawer "recent records" or search — out of scope for this slice.
- Push notifications for approval requests — not part of this slice.

## 3. Tasks

1. Add React Navigation (`@react-navigation/native`, `drawer`, `native-stack`) plus its native peer deps (`react-native-screens`, `react-native-safe-area-context`, `react-native-gesture-handler`, `react-native-reanimated`) and `react-native-paper` for Material Design components.
2. `lib/authContext.tsx`: restore the session from `AsyncStorage` on boot (previously written but never read back), so a relaunch doesn't require re-login.
3. `lib/theme.ts`: mirror web's banner-color presets; force `Appbar.Header`/`FAB` to read `theme.colors.primary`/`onPrimary` explicitly, since react-native-paper's Material Design 3 components don't default to `primary` the way MUI's do.
4. `navigation/`: `RootNavigator` (auth-gated), `AuthStack`, `AppDrawer` wrapping `AppStack` (native stack holding every real screen).
5. `components/TopBanner.tsx`: shared header — hamburger/back button, title, profile menu.
6. `components/DrawerContent.tsx`: family/patient tree (`List.Accordion`), refetched every time the drawer opens; Settings intentionally not included here.
7. Port every screen from the old single-file `App.tsx` into its own file under `screens/`, restyled with react-native-paper.
8. Rename "Timeline" → "Health Record" in every user-facing string across both `apps/web` and `apps/mobile` (headings, error messages, settings labels) — internal identifiers (route names, component names, the `getMyTimeline()` API method) were deliberately left unchanged.

## 4. Test List

No automated tests — this slice is UI/navigation structure only, with no API surface change. Verified manually against a running Expo Go session on Android and iOS:
- Cold-launching the app after a prior login lands on the health record without a login prompt.
- Hamburger drawer lists real family/patient data and navigates correctly; Settings does not appear in it.
- Profile menu reaches Profile, Settings, and Log out; Log out returns to the login screen and a subsequent relaunch does not restore the old session.
- Changing the banner color in Settings visibly updates the top banner and the FAB.
- "Health Record" wording appears everywhere "Timeline" previously did, on both apps.

## 5. Definition of Done

- `apps/mobile` and `apps/web` both typecheck (`npx tsc --noEmit`).
- Manually verified on a real device/emulator per the test list above.
- No regression to existing family/upload/profile flows carried over from the pre-navigation-rework app.
