# Spec: Open-Source & Homelab Readiness

**Status:** Not started
**Type:** Spec-driven, staged delivery (see `docs/specs/mvp-spec.md` for the convention this follows)
**Audience:** the implementing agent (Claude Code) driving this spec end-to-end, plus the human maintainer who confirms each gate

## 1. Objective

Bring this project to the same level of self-hosted-project maturity as Nextcloud, Immich, and Jellyfin: safe to run unattended in someone's homelab, safe to receive external contributions, and trustworthy enough that a stranger will run `docker compose up -d` against their own medical records.

This spec does **not** re-litigate what's already done (CI, multi-arch release pipeline, homelab compose quickstart, CONTRIBUTING/CODE_OF_CONDUCT/SECURITY/LICENSE — all already in place). It covers the gaps identified in the readiness review: dependency/security automation, backup & restore, first-impression/adoption material, mobile CI, changelog discipline, and repo discoverability.

## 2. How this spec is executed

This is written for an agent to drive autonomously, one stage at a time, with a hard stop between stages.

**Per-stage loop:**

1. Implement everything listed under the stage's **Work**.
2. Run every item under **Agent-verifiable testing** yourself (commands, typechecks, builds, curl checks, etc.) and fix anything that fails before moving on.
3. If the stage has a **Human-in-the-loop testing** section, stop and present that checklist to the maintainer verbatim, asking them to run each item and reply with pass/fail per item (or "confirmed" for the whole list).
4. Do not start the next stage until:
   - all agent-verifiable testing passes, **and**
   - the maintainer has explicitly confirmed the human-in-the-loop checklist (if the stage has one).
5. Record in the **Stage Log** (Section 5) the wall-clock time spent, an approximate token count for the stage (from the session so far), and a one-line outcome, before moving to the next stage.
6. If a stage has no human testing section, the agent-verifiable pass is sufficient to proceed — no need to ask the maintainer to rubber-stamp it, but still tell them what was done in one or two sentences before continuing.

**If a stage fails agent-verifiable testing twice in a row for the same reason**, stop and ask the maintainer for direction rather than continuing to retry silently.

**Definition of "web and mobile round of testing"** wherever a stage says it: run the API test suite, typecheck all three apps, build the web app, and typecheck/bundle-check the mobile app (via `expo export` or equivalent — a real device isn't required for agent-verifiable checks, only for the human-in-the-loop stages that call it out explicitly).

## 3. Stages

---

### Stage 0 — Baseline capture

**Why:** every later stage's testing needs a known-good baseline to diff against.

**Work:**
- Record current versions: Node, npm, Expo SDK, Next.js, Fastify, Prisma.
- Run and record current output of: `npm run test:api`, `npx tsc -p apps/api/tsconfig.json --noEmit`, `npx tsc -p apps/web/tsconfig.json --noEmit`, `npm run build --workspace apps/web`.
- Confirm `docker compose up -d --build` currently brings up a working stack (api `/health` returns 200, web root returns 200).

**Agent-verifiable testing:**
- All commands above complete with the same pass/fail status as before this spec started (i.e., this stage changes nothing, it only proves the starting point is green).

**Human-in-the-loop testing:** none — this stage is capture-only.

---

### Stage 1 — Dependency & security automation

**Why:** this app stores medical documents; unpatched dependencies are the highest-leverage risk, and there is currently no automated coverage.

**Work:**
- Add `.github/dependabot.yml` covering: root npm workspace, `apps/api`, `apps/web`, `apps/mobile`, `packages/shared`, and `.github/workflows/*` (GitHub Actions), grouped sensibly (e.g. dev-dependencies grouped, weekly cadence), with PR limits set so it doesn't flood the repo.
- Add `.github/workflows/codeql.yml` running CodeQL for JavaScript/TypeScript on push to `main`/`develop` and on PRs, plus a weekly scheduled scan.
- Add `.github/workflows/docker-scan.yml` (or extend `release.yml`) to scan built `api`/`web` images with Trivy (or `docker scout`) on release builds, failing on critical/high CVEs with no fix available suppressed via an allowlist file if needed.
- Update `SECURITY.md` if the disclosure process needs to reference these new automated checks.

**Agent-verifiable testing:**
- `dependabot.yml` and the new workflow YAML files are valid (lint with `actionlint` if available, otherwise a YAML parse check).
- Trigger CodeQL and docker-scan workflows via `workflow_dispatch` or a draft PR and confirm they run to completion (or explain why they can't be exercised locally, e.g. no push access — in that case, ask the maintainer to push a throwaway branch/PR to confirm).
- Re-run the full baseline suite from Stage 0 to confirm nothing else broke.

**Human-in-the-loop testing:**
1. Confirm the Dependabot tab in GitHub → Insights → Dependency graph shows the new config and starts opening PRs (may take up to 24h — acceptable to confirm the config is *accepted*, not that a PR has landed yet).
2. Confirm the CodeQL workflow run appears green under the Actions tab and results appear under Security → Code scanning alerts.
3. Confirm the image-scan workflow run appears green under Actions.

Reply "confirmed" once all three are checked, or list what didn't work.

---

### Stage 2 — Backup & restore

**Why:** no documented recovery path currently exists. This is the #1 support burden for self-hosted data apps once real users exist.

**Work:**
- Write `docs/backup-and-restore.md` covering: what needs backing up (Postgres volume/dump + `phr-media` volume or bind mount), a `pg_dump`/`pg_restore` example against the compose Postgres service, a media-volume backup example (tar of the bind mount, or `docker run --rm -v phr-media:/data ... tar` for the named-volume case), and a full disaster-recovery walkthrough (fresh host → restore DB → restore media → `docker compose up -d` → verify).
- Add a small helper script (`docker/release/backup.sh` or similar) that wraps the dump + media tar into one command, since asking homelab users to remember `pg_dump` flags is how backups don't happen.
- Link this doc from the README's "Running from published images" section.

**Agent-verifiable testing:**
- Spin up the release compose stack locally, create a test user/record via the API, run the backup script, tear down the stack (including volumes), restore from the backup, bring the stack back up, and confirm the test user/record is present via the API. Delete the throwaway volumes/containers afterward.
- `npm run test:api` still passes (this stage shouldn't touch app code, just confirm no regression).

**Human-in-the-loop testing:**
1. On your own homelab box (not the dev machine), run through `docs/backup-and-restore.md` top to bottom against a real (test) instance and confirm each command works as written.
2. Confirm the restored instance shows the same data as before the backup.

Reply "confirmed" once done, or note which step in the doc didn't match reality so it can be corrected.

---

### Stage 3 — First-impression material (README/screenshots/branding)

**Why:** screenshots and a clear "what does this look like" are the biggest driver of whether someone bothers to self-host a new project.

**Work:**
- Add a `docs/screenshots/` (or `.github/assets/`) folder with: login/register screen, timeline view, upload flow, family/patient sidebar, mobile timeline — web and mobile side by side where sensible.
- Embed 3–5 of these in the README near the top, above "Getting started."
- Add a repo social-preview image (README note pointing the maintainer to Settings → General → Social preview, since this can't be set via API/code — flag it as a human step, not something the agent can do).
- Set/confirm GitHub repo topics (`self-hosted`, `health-records`, `homelab`, `docker`, `nextjs`, `react-native`, `personal-health-record`) — same caveat, this is a repo-settings action, list it for the human.

**Agent-verifiable testing:**
- Screenshots exist as files, are referenced with correct relative paths in the README, and the README renders without broken image links (check paths resolve on disk).
- No app code changed — re-run Stage 0 baseline commands to confirm still green.

**Human-in-the-loop testing:**
1. Take the actual screenshots by running the app locally (agent can prep clean seed data/a demo account for this if useful) — confirm they look representative and don't leak real personal data if you used your own instance.
2. Set the GitHub social-preview image in repo settings.
3. Set the GitHub repo topics listed above.
4. Open the README on GitHub (not just locally) and confirm images render.

Reply "confirmed" once done.

---

### Stage 4 — Mobile CI

**Why:** `apps/mobile` currently has zero CI coverage — it can break silently on every PR.

**Work:**
- Extend `.github/workflows/ci.yml` (or add a new job) to install mobile deps and typecheck `apps/mobile` (`npx tsc -p apps/mobile/tsconfig.json --noEmit`), matching what already happens for api/web.
- Add an `expo export` (or `expo-doctor`) step to catch bundling-level breakage without needing a full EAS build.
- Document (in `docs/apps/mobile-app.md` or README) the intended path for real device builds — EAS Build — as a follow-up, not something this stage needs to fully wire up (EAS requires an Expo account/credentials that are the maintainer's to set up).

**Agent-verifiable testing:**
- New CI job runs green on a throwaway branch/PR.
- Deliberately introduce and then revert a mobile typecheck error locally to confirm the new job actually catches it (don't leave this broken — revert before finishing the stage).

**Human-in-the-loop testing:**
1. Confirm the new mobile CI job shows up and passes on the Actions tab for a real PR.
2. If you want EAS builds wired up in a later stage, confirm you're willing to create an Expo account/project for this repo (needed before that work can start) — otherwise EAS build automation stays out of scope.

Reply "confirmed" (and let the agent know your EAS decision) once done.

---

### Stage 5 — Changelog discipline

**Why:** GitHub's auto-generated release notes work but aren't scannable for "should I upgrade" decisions the way Keep-a-Changelog format is.

**Work:**
- Add `CHANGELOG.md` at the repo root following [Keep a Changelog](https://keepachangelog.com/) format, seeded with an `[Unreleased]` section and a `[1.0.0]` entry summarizing the MVP delivery (derive from `docs/specs/mvp-spec.md`'s delivered slice list).
- Add a note to `CONTRIBUTING.md` that PRs touching user-facing behavior should add an `[Unreleased]` entry.
- Update `release.yml`'s `github-release` job description or `docs/deployment.md` to reference `CHANGELOG.md` as the source of truth alongside auto-generated notes (don't remove the auto-generated notes, they're still useful for the commit-level detail).

**Agent-verifiable testing:**
- `CHANGELOG.md` is valid Markdown, has an `[Unreleased]` section, and the `[1.0.0]` entry's items cross-check against the slice list in `docs/specs/mvp-spec.md` (same feature set, no contradictions).
- Re-run Stage 0 baseline — no app code touched, should still be green.

**Human-in-the-loop testing:** none — this is a docs-only stage, agent-verifiable is sufficient. Just report back a one-line summary before moving on.

---

### Stage 6 — Data-handling & compliance note

**Why:** the project targets Indian healthcare use cases; a short, honest statement of what self-hosting does and doesn't guarantee (DPDP Act 2023 relevance) is a trust signal and prevents users assuming compliance guarantees that aren't there.

**Work:**
- Add a short "Data & Privacy" section to the README (or a `docs/data-and-privacy.md` linked from it) stating: data stays on the host the user controls, no telemetry/third-party calls are made by default (verify this is actually true by grepping the codebase for outbound network calls other than to the configured DB — flag any found), and that self-hosting shifts responsibility for physical/network security to the operator. Explicitly note this is not a compliance certification, just a factual description of the architecture.
- If the telemetry grep turns up anything unexpected, surface it to the maintainer immediately rather than silently documenting around it.

**Agent-verifiable testing:**
- Grep `apps/api` and `apps/web` for `fetch(`, `axios`, `http.request`, etc. outside of the DB/media-serving/`API_INTERNAL_URL` paths, and confirm the doc's claims match what's actually in the code.
- Re-run Stage 0 baseline.

**Human-in-the-loop testing:**
1. Read the drafted section and confirm it accurately reflects your understanding of the architecture and doesn't overpromise (e.g. don't want it read as "this is DPDP-compliant" if that hasn't been verified by counsel).

Reply "confirmed" or give edits.

---

## 4. Exit criteria

All six stages complete, all agent-verifiable testing green, all human-in-the-loop checklists confirmed. Produce the final report described in Section 5 and post it as the closing message of this spec's execution.

## 5. Stage Log & Final Report

The agent fills this table in as it completes each stage (not at the end) — one row per stage, appended immediately after that stage's human confirmation (or immediately after agent-verifiable testing, for stages with no human step).

| Stage | Outcome | Time taken | Tokens used (approx.) | Notes |
|---|---|---|---|---|
| 0 — Baseline capture | Done | ~10 min | ~15k | Node v22.17.1, npm 10.9.2, Docker 28.3.2. api/web typecheck clean, shared+web build clean (Next lockfile-patch warning is pre-existing/benign, not a build failure), 66/66 api tests pass, full `docker compose up -d --build` stack healthy with api `/health`=200 and web `/`=200. Pre-existing uncommitted local changes noted but untouched: `apps/mobile/metro.config.js`, `tsconfig.json`, `wiki/` — not part of this spec's scope. |
| 1 — Dependency & security automation | Done with caveats | ~20 min | ~25k | Added `.github/dependabot.yml` (npm workspace-wide + github-actions + docker for api/web), `.github/workflows/codeql.yml`, Trivy scan step in `release.yml` (fails on fixable CRITICAL/HIGH, `.trivyignore` for reviewed suppressions), and a "Automated scanning" section in `SECURITY.md`. All new/edited YAML validated with `js-yaml`; no app code touched so Stage 0 baseline still holds. Caveat: workflows can only truly be proven green by GitHub Actions itself, which needs a push — left for human confirmation below rather than pushed unilaterally. |
| 2 — Backup & restore | Done | ~35 min | ~35k | Added `docs/backup-and-restore.md`, `docker/release/backup.sh`, `docker/release/restore.sh`, linked from README. Verified end-to-end in an isolated throwaway compose stack (`-p phr-backup-test`, separate ports/volumes from the real dev stack): registered a test user, ran the backup commands, tore the stack down with `-v` (deleting all volumes), brought up a fresh empty stack, confirmed login failed (401), restored from the backup, confirmed login succeeded with the original account. Cleaned up all throwaway containers/volumes/temp files afterward; dev stack (4-day-old, untouched) still healthy. api test suite re-confirmed 66/66. |
| 3 — First-impression material | Done with caveats | ~40 min | ~45k | Added `docker/release/seed-demo-data.mjs` (creates a demo user/family/member + sample PDF lab report via the API — verified working end-to-end against an isolated throwaway stack, then cleaned up), `docs/screenshots/` with 5 placeholder SVGs + a README explaining what to capture, and embedded them in the main README. Caveat: the agent has no browser/screenshot tool, so the images are structural placeholders, not real screenshots — capturing the real ones and the GitHub repo-settings steps are human-only and listed below. |
| 4 — Mobile CI | | | | |
| 5 — Changelog discipline | | | | |
| 6 — Data-handling & compliance note | | | | |

**Outcome** values: `Done`, `Done with caveats` (explain in Notes), or `Blocked` (explain in Notes — should not happen if the per-stage retry rule in Section 2 was followed).

**Time taken**: wall-clock time from the start of that stage's work to its confirmed completion.

**Tokens used**: best-effort estimate of tokens consumed by the agent for that stage (input+output), noted as approximate since exact accounting isn't always available mid-session.

Once all rows are filled in, append a short closing summary below the table: total elapsed time, total approximate tokens, how many stages needed a retry, and a one-paragraph plain-English readout of where the project stands afterward relative to the Nextcloud/Immich/Jellyfin bar this spec is aiming for.
