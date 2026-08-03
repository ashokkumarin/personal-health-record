# Slice 8: Branding & Versioning

Adds a product mark and a visible release label ahead of tagging the first release as MVP v1.0.

## 1. Acceptance Criteria

1. Given the web app, when any page loads, then the PHR logo (teal badge with pulse mark) is shown in the top nav and as the browser tab favicon.
2. Given the logged-out landing page, then the same logo is shown above the product name.
3. Given any page, when the user scrolls to the bottom, then a footer shows the product name and the current release label (`MVP v1.0`).
4. Given the repo's `package.json` files (root, `apps/*`, `packages/*`), then their `version` field is `1.0.0`, matching the `MVP v1.0` label shown in the UI.

## 2. Explicitly Deferred

- Mobile app branding (icon/splash screen) — web-only for this slice.
- A settings/about page surfacing build metadata (git SHA, build date) beyond the static release label.

## 3. Tasks

1. `apps/web/public/logo.svg` + `apps/web/app/icon.svg` (Next.js App Router's automatic favicon convention).
2. `packages/shared/src/version.ts`: `APP_VERSION` / `APP_RELEASE_LABEL` constants, single source of truth for the release label shown in the UI.
3. `apps/web/app/components/Footer.tsx`, wired into `ThemeRegistry.tsx` so it appears on every page.
4. `Nav.tsx` and the logged-out `page.tsx` view updated to render `/logo.svg` in place of the generic Material icon.
5. `version` bumped to `1.0.0` in the root and every workspace `package.json`.

## 4. Definition of Done

- Logo renders in the nav bar, the logged-out landing page, and as the favicon.
- Footer renders `MVP v1.0` on every page.
- `cd apps/web && npx next build` succeeds with the new assets/components.
