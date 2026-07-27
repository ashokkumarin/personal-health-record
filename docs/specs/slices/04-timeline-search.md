# Slice 4: Timeline & Search

Implements requirements-and-project-plan.md Sections 6.5 (Timeline View) and 6.7 (Search) via one endpoint — filters double as both features, matching mvp-spec.md's Story 5 and Section 4.6.

## 1. Acceptance Criteria

1. Given records exist across a family's patients, when a member requests the timeline with no filters, then records are returned in descending chronological order (`capturedAt` if set, else `uploadedAt`).
2. Given a `patientId` filter, then only that patient's records are returned.
3. Given a `recordType` filter, then only matching records are returned.
4. Given a `dateFrom`/`dateTo` range, then only records within that range are returned.
5. Given a keyword (`q`), then only records whose title or OCR text contains it (case-insensitive) are returned.
6. Given a user who is not a member of the family, then the request is rejected with 403.

## 2. Explicitly Deferred

- Full-text search ranking/relevance — this is a simple case-insensitive `contains` match, adequate for MVP scale.
- Search across tags/labels (requirements doc Section 6.7 mentions "basic tags" — no tagging UI exists yet; deferred to a future slice if needed).
- Mobile filters/search UI — mobile's timeline screen is list-only this slice (see technical-design.md).

## 3. Tasks

1. `GET /families/:familyId/records` with `patientId`/`recordType`/`dateFrom`/`dateTo`/`q` query params.
2. Tests written first (see below).
3. `packages/shared`: `listRecords` client method.
4. Web: `/families/[id]/timeline` page with filter controls + search box.
5. Mobile: read-only Timeline screen.

## 4. Test List (written before implementation, part of `apps/api/src/routes/records.test.ts`)

- `list: records are returned in descending chronological order` (AC1)
- `list: patientId filter narrows results` (AC2)
- `list: recordType filter narrows results` (AC3)
- `list: date range filter narrows results` (AC4)
- `list: keyword search matches title` (AC5)
- `list: non-member of the family gets 403` (AC6)

## 5. Definition of Done

- All tests above pass.
- Web timeline page correctly filters and finds records by keyword against real uploaded data.
