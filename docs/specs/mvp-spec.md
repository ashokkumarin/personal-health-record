# MVP Specification: Personal Health Record System

**Status: Delivered — MVP v1.0** (`docs/specs/slices/01` through `08`; see each slice doc for acceptance criteria and definition of done).

## 1. Objective
Build a first release of the personal health record system that allows a user to create an account, create a family with multiple admins, add family members either as fully-managed patient profiles or as linked user accounts (with approval), upload and thumbnail medical documents, view/preview/edit/delete them in a timeline, and control who in the family can see them.

## 2. Scope of This Spec
This spec covers the full MVP v1.0 delivery — every slice in `docs/specs/slices/`, not just the first.

### In Scope (delivered)
- User sign-up, login, logout (Slice 1)
- Family creation, ownership, multiple admins, member removal, rename, soft-delete (Slice 2, Slice 6)
- Three ways to add a family member: fully family-managed (no account), new linked account (no approval needed), or link to an existing account (requires that user's approval) (Slice 2)
- Upload an image or PDF medical document, stored under the selected patient profile, with best-effort OCR (Slice 3)
- Chronological timeline per patient, with filtering by document type/date range and keyword search (Slice 4)
- Per-patient visibility toggle controlling whether other family members can see a linked patient's records (Slice 5)
- Personal home timeline, sidebar family/patient tree navigation, profile page (name/email/optional photo/optional mobile number), settings page for family management (Slice 6)
- Record thumbnails (real rendered PDF first page or resized image), click-to-preview, edit metadata, replace the underlying file, delete a record (Slice 7)
- Product logo/favicon and a visible release label (Slice 8)

### Out of Scope (for v1.0)
- Advanced/high-accuracy OCR or structured data extraction
- Medication reminders
- Insurance or payment flows
- Doctor/clinic integrations
- Multi-language UI
- Password reset and phone-based login (deferred from Slice 1)
- Mobile parity for navigation rework, settings, and record editing (mobile has read-only/basic flows only)

## 3. User Stories

### Story 1: Account creation
As a new user, I want to create an account so that I can start managing my family's health records.

### Story 2: Family setup
As a family owner, I want to create a family and become its owner so that I can manage records for family members.

### Story 3: Add patient profile
As a family owner or admin, I want to add a family member and create a patient profile so that documents can be stored under that person.

### Story 4: Upload medical document
As a user, I want to upload a prescription, lab report, bill, or note so that it is stored securely against the correct patient.

### Story 5: Timeline view
As a user, I want to see uploaded records in a timeline so that I can review them chronologically.

### Story 6: Sharing and visibility
As the family member a patient profile is linked to, I want to control whether my records are visible to the rest of the family so that my health data stays private by default.

### Story 7: Review and manage a record
As the uploader, a family owner/admin, or the patient a record belongs to, I want to preview a document's thumbnail, view it full-size, edit its details, replace the file, or delete it so that mistakes are correctable without contacting support.

### Story 8: Personal navigation
As a logged-in user, I want to land on my own timeline and move between my families and their patients from a single sidebar so that I don't have to hunt through a families list to find what I'm looking for.

## 4. Functional Requirements

### 4.1 Authentication
- The system shall allow a user to register with email and password.
- The system shall allow a user to log in and log out.
- The system shall reject duplicate email registrations.

### 4.2 Family Management
- A user shall be able to create a family and become its owner.
- A family shall always have exactly one owner but may have multiple admins.
- An owner/admin shall be able to rename or (soft-)delete the family, and remove a member.
- A family name shall be unique among that user's non-deleted families.

### 4.3 Patient Profile Management
- A family owner/admin shall be able to add a member via one of three modes: no linked account (family-managed), a brand-new linked account (no approval needed), or linking to an existing user's account (requires that user's approval).
- Each patient profile shall belong to exactly one family and one member.
- A patient profile shall be displayed in the user interface for selection when uploading a document.

### 4.4 Document Upload
- A user shall be able to upload an image or PDF file.
- The system shall store the file under the selected patient profile.
- Each uploaded document shall have a title, document type, document date, upload date, and linked patient.
- The system shall reject unsupported file types.
- The system shall best-effort generate a thumbnail (resized image, or a rendered PDF first page) and best-effort run OCR on the file; failures degrade gracefully rather than blocking the upload.

### 4.5 Timeline
- The system shall display uploaded records in descending chronological order as a thumbnail grid.
- The system shall allow filtering by document type and date range.
- Clicking a thumbnail shall open a full preview (image or embedded PDF) without leaving the timeline.

### 4.6 Search
- The system shall support basic keyword search across record titles/OCR text, plus filtering by document type and date range.

### 4.7 Sharing & Visibility
- Records shall be private by default.
- An unlinked (family-managed) patient's records shall be visible to all active family members by default, since there is no other account to grant visibility to.
- A linked patient's records shall be visible only to that linked user by default; the linked user may opt in to make them visible to the rest of the family.

### 4.8 Record Management
- The uploader, a family owner/admin, or the record's own linked patient shall be able to edit a record's title/type/date, replace its underlying file, or delete it.
- Any other family member attempting these actions shall be rejected with a clear error.

### 4.9 Account & Navigation
- A logged-in user shall land on their own timeline, not a families list.
- A sidebar shall present a navigable tree of the user's families and each family's patients.
- A profile page shall let the user edit name (required), email (required), photo (optional), and mobile number (optional).
- A settings page shall provide family creation and management entry points.

## 5. Non-Functional Requirements
- The experience shall be mobile-first and simple to use.
- Uploading and viewing documents shall feel responsive.
- Medical records shall be stored securely.
- The system shall show clear validation messages for failed uploads.
- Navigating between accounts/patients shall never show stale data from a previous session or selection.

## 6. Acceptance Criteria

Each slice doc under `docs/specs/slices/` states its own acceptance criteria in full; this section lists one representative criterion per major capability area as a quick index.

### Account creation
- Given a valid email and password, when a user registers, then an account is created successfully.

### Family creation
- Given an authenticated user, when they create a family, then the family is created and they are assigned as owner.

### Add patient profile
- Given an authenticated family owner/admin, when they add a member, then a patient profile is created (linked or unlinked depending on the mode chosen) and shown in the patient list.

### Upload document
- Given an authenticated user, when they upload a supported file for a patient, then the file is stored, thumbnailed, and displayed in that patient's records.

### Timeline
- Given uploaded records exist, when the user opens the timeline, then records are shown as thumbnails in chronological order, and clicking one opens a full preview.

### Sharing
- Given a linked patient's records, when the linked user has not opted in to sharing, then other family members cannot see them.

### Record management
- Given a record the caller is authorized to manage, when they edit, replace, or delete it, then the change takes effect; an unauthorized member is rejected with 403.

## 7. Implementation Guidance for Spec-Driven Development
1. Write the acceptance criteria first.
2. Break each acceptance criterion into implementation tasks.
3. Create tests before implementing each feature.
4. Implement the smallest slice that satisfies the test.
5. Review the spec after each iteration and adjust only if the requirement changes.

## 8. Delivery History

Delivered in order (see each slice doc for full acceptance criteria and definition of done):
1. `01-auth.md` — Authentication
2. `02-family.md` — Family & patient profile management
3. `03-upload.md` — Document upload
4. `04-timeline-search.md` — Timeline & search
5. `05-sharing.md` — Sharing & visibility
6. `06-navigation-profile-settings.md` — Navigation, profile & settings
7. `07-record-thumbnails-preview-edit-delete.md` — Record thumbnails, preview, edit & delete
8. `08-branding-and-versioning.md` — Branding & versioning (MVP v1.0)

No further slices are currently planned; this is the MVP v1.0 release.
