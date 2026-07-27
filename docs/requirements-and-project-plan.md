# Personal Health Record (PHR) Management System

> **Status: Delivered as MVP v1.0.** This document is the original discovery/planning doc and is kept as-is for historical context. For the as-built spec, data model, and delivery history, see [docs/specs/mvp-spec.md](specs/mvp-spec.md) and [docs/specs/technical-design.md](specs/technical-design.md); for the current setup/feature list see the root [README.md](../README.md).

## 1. Project Summary

This project aims to build a mobile-first personal health record system for India, where health documents are often scattered across paper prescriptions, lab reports, pharmacy bills, and handwritten notes. The MVP will let users capture or upload these documents, organize them by patient, and view them in a timeline.

## 2. Problem Statement

Today, most healthcare interactions in clinics and hospitals are fragmented:
- Doctor visits often result in handwritten prescriptions or notes.
- Patients may buy only part of the prescribed medicines.
- Pharmacy bills are often kept separately.
- Lab reports may be provided as hard copies or PDFs.
- There is no single place to consolidate these records.

This app will help users collect, store, and review their medical documents in one place.

## 3. Vision

Create a simple, trustworthy, mobile-first system that helps families keep personal health records in one place, with secure access and easy document capture.

## 4. MVP Goals

The MVP should enable a user to:
- Create an account.
- Create family members.
- Capture or upload medical documents.
- Store records under a patient-specific folder.
- View records in a timeline.
- Share records with family members or linked users.
- Create a new user account directly for a family member (no approval needed), or link an existing user account to a family member with approval.

## 5. Target Users

- Individual users who want to manage their own health records.
- Families who want to maintain shared health records for parents, children, or dependents.
- Users who may not be tech-savvy and need a simple, guided experience.

## 6. Functional Requirements

### 6.1 User Account Management
- Users can register and log in.
- Users can create a profile.
- Users can reset password and manage account settings.
- Authentication should support email/phone-based login.

### 6.2 Family and Member Management
- One user can create a family profile. That user becomes the owner.
- A family must always have exactly one owner, but can have multiple admins.
- Admins have the same management rights as the owner except transferring/removing ownership.
- The owner (or an admin) can add family members. Each family member gets their own patient profile (a patient profile belongs to exactly one member, not shared across users).
- When adding a family member, the owner/admin can either:
  - Create a new user account on the member's behalf (e.g. for children or dependents who won't manage their own login) and directly link it to the new patient profile — no approval step needed in this case.
  - Link to an existing app user, which requires approval from that user before the link is active.

### 6.3 Record Ingestion
The system should support capturing and storing the following document types:
- Prescription photos
- Lab reports (hard copy photos or PDF uploads)
- Pharmacy bills
- General medical notes or scanned documents

Supported input methods:
- Camera capture from mobile app
- File upload from phone storage (images and PDFs only; plain text notes are not supported in the MVP)

Basic OCR should run on uploaded prescriptions/notes (handwritten, printed, or photographed) to extract text where possible, to aid search and record detail display. OCR output is a best-effort assist, not a replacement for the original image/PDF.

### 6.4 Record Organization
- Every patient should have a separate data folder or storage container.
- Records should be grouped under a patient profile.
- Each record should include metadata such as:
  - document type
  - date
  - description
  - source
  - uploaded by
  - linked patient

### 6.5 Timeline View
- Records appear in a chronological timeline.
- Users can filter by patient, document type, or date range.
- Users can open a record to view details and download/share it.

### 6.6 Permissions and Sharing
- Records are private by default.
- If a patient profile has no linked user account (owner/admin created and manages it on the member's behalf), the owner/admins can see that patient's records by default, since there is no other account to grant visibility to.
- If a patient profile is linked to its own user account, that account owner controls visibility and can choose whether other family members can view their records.
- Owners and admins can decide who can view a patient's records, subject to the rule above.
- Existing-user linking requires approval from that user.
- Shared access should be limited to authorized family members only.

### 6.7 Search and Basic Organization
- Users can search records by keyword, patient name, document type, or date.
- Basic tags or labels should be supported.

## 7. Non-Functional Requirements

- Mobile-first experience, with a web dashboard as a first-class surface (not mobile-only).
- Fast upload and storage of image/PDF documents.
- Secure storage of medical information.
- Clear error handling for failed uploads or invalid files.
- Simple UI for non-technical users.
- Support for offline capture where possible.
- English-only UI for the MVP; design should keep localization (e.g. Hindi/regional languages) as a future option rather than ruling it out.

## 8. Data Model (Initial)

### Core entities
- User
- Family
- FamilyMembership
- PatientProfile
- MedicalRecord
- ShareRequest
- ApprovalRequest
- AuditLog

### Suggested fields
- User: id, name, email/phone, password hash, role, createdAt
- Family: id, name, ownerId, createdAt
- FamilyMembership: id, familyId, userId, relation, role (owner/admin/member), status, createdAt
- PatientProfile: id, familyId, linkedUserId (nullable), name, dateOfBirth, gender, visibility, createdAt
- MedicalRecord: id, patientId, recordType, title, filePath, fileType, ocrText (nullable), capturedAt, uploadedAt, createdBy
- ShareRequest: id, requesterId, targetUserId, patientId, status

## 9. Initial User Flows

### Flow A: Create account and add family member
1. User creates account and becomes the family owner.
2. User creates a family.
3. User adds a family member, and either:
   - creates a new user account for them directly (patient profile is linked immediately, no approval needed), or
   - links to an existing user account (a request is sent for approval).

### Flow B: Capture and store a prescription
1. User opens app.
2. User selects patient.
3. User captures prescription photo.
4. App stores the file under that patient’s data folder.
5. App shows the record in the timeline.

### Flow C: View records
1. User opens timeline.
2. User filters by patient or date.
3. User opens a specific record.

## 10. Assumptions

- The MVP has both a mobile app and a web dashboard, sharing the same backend.
- Document storage is cloud-based, with patient-specific folders.
- Basic OCR is included in the first version for prescriptions/notes (handwritten, printed, or photographed), to aid search and display, not for medical interpretation.
- The initial focus is document capture, storage, timeline, and family linking.

## 11. Out of Scope for MVP

- AI-based diagnosis or medical insights
- Advanced/high-accuracy OCR or structured data extraction (only basic best-effort OCR is included)
- Appointment scheduling
- Medication reminders
- Insurance integration
- Payment processing
- Doctor/clinic integrations
- Regional language / localized UI (English-only for now)

## 12. Confirmed Decisions

These were open questions during discovery and have now been resolved:

1. **Patient profiles**: Each family member has their own separate patient profile. A patient profile belongs to exactly one member, not shared across multiple users.
2. **Family ownership**: A family can have multiple admins, but must always have at least one owner.
3. **Approval for linking**: Not mandatory in all cases. When adding a family member, the owner/admin can instead create a new account directly on that member's behalf and link it immediately — approval is only required when linking to an already-existing user account.
4. **Upload types**: Images and PDFs only for the MVP; plain text notes are not supported.
5. **Localization**: English-only UI for now; keep the door open to add Hindi/regional languages later.
6. **Default visibility**: Records are private by default. For patient profiles with no linked user account (owner/admin-managed on the member's behalf), the owner/admins can see the records by default. Once a patient profile is linked to its own user account, that account owner controls visibility.
7. **OCR**: Basic OCR is included in the MVP for prescriptions/notes (handwritten, printed, or photographed), to assist search and viewing — not full structured extraction.
8. **Platform**: Both a mobile app and a web dashboard are part of the plan, not mobile-only.

## 13. Recommended Implementation Approach

### Phase 0: Discovery and Requirements Finalization
- Open questions confirmed (see Section 12).
- Define the exact user roles and permissions.
- Finalize the MVP feature list.

### Phase 1: Core Foundation
- Authentication
- User profile
- Family and member management
- Patient profile creation
- Basic document upload and storage

### Phase 2: Timeline and Record Management
- Timeline view
- Filtering and search
- Record detail page
- Basic sharing and approval workflow

### Phase 3: Polish and Pilot
- UI refinement
- Error handling
- Testing with a small group of users
- Fixing usability issues

## 14. Suggested Delivery Plan

- Week 1: Finalize requirements and data model
- Week 2: Set up backend, auth, and storage structure
- Week 3: Build document upload and patient profile features
- Week 4: Build timeline and family linking flow
- Week 5: Test, refine, and prepare pilot release

## 15. Recommendation

Start with a narrow MVP focused on:
- account creation
- family creation and linking
- document upload/capture
- patient-specific folder storage
- timeline view

This will give you a useful first release quickly while keeping the system simple and practical.
