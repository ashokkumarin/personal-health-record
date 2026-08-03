# C4 — Code

The most granular C4 level. Rather than an exhaustive (and quickly stale) class
diagram of the entire codebase, this documents the **Records domain** — the
part of the system with the most moving pieces (upload, thumbnails, OCR,
visibility rules, timeline queries) and the one most illustrative of how the
rest of the codebase is shaped. Every other domain (auth, families, approvals)
follows the same pattern: a Prisma model, a shared-package client/types module,
and a Fastify route file with a couple of local authorization helper functions.

```mermaid
classDiagram
  class MedicalRecord {
    <<Prisma model>>
    +String id
    +String patientId
    +RecordType recordType
    +String title
    +String filePath
    +String fileType
    +String? thumbnailPath
    +String? ocrText
    +DateTime? capturedAt
    +DateTime uploadedAt
    +String createdById
  }

  class RecordType {
    <<enum>>
    PRESCRIPTION
    LAB_REPORT
    PHARMACY_BILL
    NOTE
  }

  class PatientProfile {
    <<Prisma model>>
    +String id
    +String familyId
    +String? linkedUserId
    +String name
    +Boolean visibleToFamily
  }

  class RecordsRoutes {
    <<Fastify plugin — routes/records.ts>>
    +POST /patients/:patientId/records
    +PUT /records/:id/file
    +GET /me/timeline
    +GET /records/:id
    +GET /families/:familyId/records
    +PATCH /patients/:id/visibility
    +PATCH /records/:id
    +DELETE /records/:id
    -isFamilyMember(familyId, userId) bool
    -isFamilyManager(familyId, userId) bool
    -isRecordVisible(patient, requesterId) bool
    -canManageRecord(record, patient, userId) bool
    -withThumbnailUrl(record) MedicalRecord
    -uploadWithThumbnail(key, buffer, mimeType) void
  }

  class StorageModule {
    <<storage.ts>>
    +uploadObject(key, body) void
    +deleteObject(key) void
    +getSignedDownloadUrl(key) Promise~string~
    +verifyFileSignature(key, expires, sig) bool
    +resolveMediaPath(key) string
    +contentTypeForKey(key) string
    -sign(key, expires) string
  }

  class ThumbnailModule {
    <<thumbnail.ts>>
    +generateThumbnail(buffer, mimeType) Promise~Buffer?~
  }

  class OcrModule {
    <<ocr.ts>>
    +extractText(buffer, mimeType) Promise~string?~
  }

  class RecordsClient {
    <<packages/shared — records.ts>>
    +uploadRecord(patientId, fields, file) Promise~MedicalRecord~
    +replaceRecordFile(recordId, file) Promise~MedicalRecord~
    +getRecord(id) Promise~MedicalRecord~
    +listRecords(familyId, filters) Promise~MedicalRecord[]~
    +updateRecord(id, input) Promise~MedicalRecord~
    +deleteRecord(id) Promise~void~
    +setPatientVisibility(patientId, visible) Promise~PatientProfile~
    +getMyTimeline() Promise~MyTimeline~
  }

  class RecordGrid {
    <<apps/web — components/RecordGrid.tsx>>
    Grid/list rendering, month grouping, preview dialog, edit/delete menu, multi-select + bulk download
  }

  class RecordListMobile {
    <<apps/mobile — components/RecordList.tsx>>
    Grid/vertical-timeline rendering, month/date grouping, multi-select
  }

  MedicalRecord "1" --> "1" RecordType
  MedicalRecord "many" --> "1" PatientProfile : belongs to
  RecordsRoutes ..> MedicalRecord : reads/writes via Prisma
  RecordsRoutes ..> PatientProfile : checks visibility on
  RecordsRoutes --> StorageModule : uses
  RecordsRoutes --> ThumbnailModule : uses
  RecordsRoutes --> OcrModule : uses
  RecordsClient ..> RecordsRoutes : calls over HTTP
  RecordGrid --> RecordsClient : uses
  RecordListMobile --> RecordsClient : uses
```

## Reading this diagram

- **`RecordsRoutes`** is the only place authorization for records lives — see
  its four private helper methods. There's no separate "authorization service";
  these are plain TypeScript functions colocated with the routes that use them.
- **`RecordsClient`** (in `@phr/shared`) is the single typed contract both
  `RecordGrid` (web) and `RecordListMobile` (mobile) build their UI against —
  neither app hand-rolls `fetch()` calls for records. This is the pattern to
  follow for any new domain: add types + a client factory to `packages/shared`
  first, then consume it from both UIs.
- **Thumbnails are synchronous, OCR is not** — reflected here by
  `uploadWithThumbnail` being a private method on the route class (runs inline,
  blocks the response) while `OcrModule.extractText` is called but not awaited
  before responding (see [C3](C3-Component#thumbnail-generation-is-synchronous-ocr-is-not)).
- This same shape — Prisma model + shared-package client + Fastify route file
  with local auth helpers + a web component + a mobile component — repeats for
  **Family** (`family.ts` client, `FamilyGroupsSection`/`Sidebar` on web,
  `FamilyDetailScreen`/`DrawerContent` on mobile) and **User** (`auth.ts`
  client, `ProfilePage`/`AppearanceSection` on web, `ProfileScreen` on mobile).
  Records was chosen for this page because it's the domain where that shape is
  most stress-tested (file handling, background jobs, multi-view rendering).
