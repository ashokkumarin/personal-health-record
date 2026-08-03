# Personal Health Record (PHR)

A self-hosted, open-source personal health record platform for individuals and families to store, organize, and review medical documents in one place.

## The concept

Most healthcare interactions are fragmented — a handwritten prescription here, a pharmacy bill there, a lab report as a PDF from three months ago. There's rarely one place to see it all together. PHR fixes that: a **family** creates **patient profiles** for its members (linked to a real user account, or account-less for dependents like children or elderly relatives who won't log in themselves), uploads medical documents (prescriptions, lab reports, pharmacy bills, notes) against those profiles, and browses them as a searchable, filterable **timeline**. Records are private by default; a patient can opt in to sharing their timeline with the rest of the family.

It's designed mobile-first with a web dashboard as an equal first-class surface, runs entirely self-hosted (no proprietary cloud dependency, no third-party storage), and keeps the underlying data model simple enough for a small family or homelab deployment.

## MVP features

- User registration and login
- Family creation and family member management
- Patient profiles for family members
- Upload of medical documents as images or PDFs
- Best-effort OCR and thumbnail generation
- Timeline-based browsing with search and filtering
- Preview, edit, replace, and delete of uploaded records
- Privacy controls so records remain private by default
- Web app and mobile app clients

## Architecture at a glance

TypeScript monorepo with shared contracts across the stack:

- **API**: Node.js, TypeScript, Fastify, Prisma, PostgreSQL
- **Web app**: Next.js, React, Material UI
- **Mobile app**: Expo, React Native
- **Storage**: uploaded documents/thumbnails/avatars on local disk under a configurable `MEDIA_ROOT` folder, served through a signed-URL route on the API — no object storage service required

```
apps/
  api/      Fastify + Prisma + PostgreSQL backend
  web/      Next.js 14 (App Router) frontend
  mobile/   Expo / React Native app
packages/
  shared/   Typed API clients + zod schemas, consumed by web and mobile
```

## Where to go next

### Get started
- [Getting Started](Getting-Started) — local dev setup, running from published Docker images, testing
- [Deployment](Deployment) — Docker Compose, environment variables, known build gotchas

### Contribute
- [Contributing](Contributing) — development workflow, PR expectations
- [Code of Conduct](Code-of-Conduct)
- [Security Policy](Security-Policy) — how to report a vulnerability

### Technical documentation
- [Architecture Overview](Architecture-Overview) — the C4 model, start here for how the system fits together
- [API Reference](API-Reference) — every REST route, request/response shapes, error codes
- [Data Model](Data-Model) — the Prisma schema, ERD, and authorization rules
- App guides: [Web App](Web-App) · [Mobile App](Mobile-App) · [Backend Service](Backend-Service) · [Shared Package](Shared-Package)

### Requirements & project history
- [Requirements and Project Plan](Requirements-and-Project-Plan) — original discovery/planning doc (historical)
- [MVP Spec](MVP-Spec) — delivered MVP v1.0 scope, user stories, acceptance criteria
- [Technical Design](Technical-Design) — concise as-built architecture summary
- [Feature Slices](Feature-Slices) — one doc per delivered feature slice, with full acceptance criteria

## Conventions used throughout this wiki

- **Diagrams** are Mermaid (`C4Context`/`C4Container`/`C4Component`/`classDiagram`), rendered natively by GitHub — no external tooling needed to view them.
- **API request/response bodies** are written as TypeScript-like shapes, not literal JSON Schema, for readability.
- **Error codes** (e.g. `EMAIL_ALREADY_REGISTERED`) are the literal `error` field values returned in `4xx` JSON bodies: `{ "error": "CODE", ... }`.

## License

Licensed under [AGPL-3.0-or-later](https://github.com/ashokkumarin/personal-health-record/blob/main/LICENSE). If you run a modified version of this project as a network service, the AGPL requires that you make your modified source available to that service's users.
