# MVP Specification: Personal Health Record System

## 1. Objective
Build a first release of the personal health record system that allows a user to create an account, create a family, add a family member/patient profile, upload a medical document, and view it in a timeline.

## 2. Scope of This Spec
This spec covers the first delivery slice of the product.

### In Scope
- User sign-up and login
- Family creation and ownership
- Add a family member with a patient profile
- Upload an image or PDF medical document
- Store the document under the selected patient profile
- Show records in a simple chronological timeline
- Basic search by patient name or document type

### Out of Scope
- Advanced OCR accuracy
- Medication reminders
- Insurance or payment flows
- Doctor/clinic integrations
- Multi-language UI

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

## 4. Functional Requirements

### 4.1 Authentication
- The system shall allow a user to register with email and password.
- The system shall allow a user to log in and log out.
- The system shall reject duplicate email registrations.

### 4.2 Family Management
- A user shall be able to create a family.
- The creator of the family shall become the owner.
- A family shall have exactly one owner.

### 4.3 Patient Profile Management
- A family owner/admin shall be able to create a patient profile.
- Each patient profile shall belong to one family.
- Each patient profile shall have a name.
- A patient profile shall be displayed in the user interface for selection when uploading a document.

### 4.4 Document Upload
- A user shall be able to upload an image or PDF file.
- The system shall store the file under the selected patient profile.
- Each uploaded document shall have a title, document type, upload date, and linked patient.
- The system shall reject unsupported file types.

### 4.5 Timeline
- The system shall display uploaded records in descending chronological order.
- The system shall allow filtering by patient and document type.
- The system shall display the record title and upload date.

### 4.6 Search
- The system shall support basic search by patient name and document type.

## 5. Non-Functional Requirements
- The experience shall be mobile-first and simple to use.
- Uploading and viewing documents shall feel responsive.
- Medical records shall be stored securely.
- The system shall show clear validation messages for failed uploads.

## 6. Acceptance Criteria

### Account creation
- Given a valid email and password, when a user registers, then an account is created successfully.

### Family creation
- Given an authenticated user, when they create a family, then the family is created and they are assigned as owner.

### Add patient profile
- Given an authenticated family owner/admin, when they create a patient profile, then it is stored under the family and shown in the patient list.

### Upload document
- Given an authenticated user, when they upload a supported file for a patient, then the file is stored and displayed in that patient's records.

### Timeline
- Given uploaded records exist, when the user opens the timeline, then records are shown in chronological order.

## 7. Implementation Guidance for Spec-Driven Development
1. Write the acceptance criteria first.
2. Break each acceptance criterion into implementation tasks.
3. Create tests before implementing each feature.
4. Implement the smallest slice that satisfies the test.
5. Review the spec after each iteration and adjust only if the requirement changes.

## 8. Proposed Next Delivery Slice
Build the following in order:
1. Authentication and user registration
2. Family creation and ownership
3. Patient profile creation
4. Document upload storage
5. Timeline view
