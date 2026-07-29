# Personal Health Record (PHR) — Technical Wiki

PHR is a family medical-records app: a family creates patient profiles (linked to
a user account, or account-less for dependents), uploads medical documents
(prescriptions, lab reports, pharmacy bills, notes) against those profiles, and
views them as a searchable, filterable timeline. Records can be shared within a
family or kept private to the linked patient.

This wiki is the source of truth for how the system is built. It's split into
four areas:

## Architecture (C4 model)

| Level | Page | What it shows |
|---|---|---|
| C1 | [System Context](architecture/c1-system-context.md) | PHR as a black box, its users, and the one external system it talks to |
| C2 | [Container](architecture/c2-container.md) | The deployable pieces — web app, mobile app, API service, database, media storage — and how they talk to each other |
| C3 | [Component](architecture/c3-component.md) | Inside the API service: route modules, the auth plugin, storage/thumbnail/OCR modules |
| C4 | [Code](architecture/c4-code.md) | A code-level class view of the Records domain, the most structurally representative slice of the system |

## API Reference

[**Full REST API reference**](api-reference.md) — every route in `apps/api`,
grouped by resource (auth, users, families, approvals, records, files), with
request/response shapes, status codes, and error codes.

## Data Model

[**Data model & ERD**](data-model.md) — the Prisma schema: every table, field,
relation, and the two constraints worth knowing about before you touch the
schema (the partial unique index on family names, and the 1:1 patient↔user link).

## App & service guides

| Guide | Covers |
|---|---|
| [Web app](apps/web-app.md) | Next.js app: pages, routing, auth/session handling, theming |
| [Mobile app](apps/mobile-app.md) | Expo/React Native app: navigation shell, screens, native integrations |
| [Backend service](apps/backend-service.md) | Fastify API internals: auth, file storage, thumbnails, OCR, signed URLs |
| [Shared package](apps/shared-package.md) | `@phr/shared` — the typed API clients and zod schemas both apps build on |
| [Deployment](deployment.md) | Docker images, `docker-compose.yml`, environment variables, known build gotchas |

## Project history & specs

This wiki is the detailed, living technical reference. For *how the project
got here* — the original discovery doc, the delivered MVP scope, and
slice-by-slice acceptance criteria — see [`specs/`](specs/mvp-spec.md):

- [`requirements-and-project-plan.md`](requirements-and-project-plan.md) — original discovery/planning doc (historical)
- [`specs/mvp-spec.md`](specs/mvp-spec.md) — delivered MVP v1.0 scope
- [`specs/technical-design.md`](specs/technical-design.md) — concise as-built architecture summary (this wiki is the expanded version)
- [`specs/slices/`](specs/slices/) — one doc per delivered feature slice, with acceptance criteria

## Repository layout

```
apps/
  api/      Fastify + Prisma + PostgreSQL backend
  web/      Next.js 14 (App Router) frontend
  mobile/   Expo / React Native app
packages/
  shared/   Typed API clients + zod schemas, consumed by web and mobile
docs/       You are here
```

## Conventions used throughout this wiki

- **Diagrams** are Mermaid (`C4Context`/`C4Container`/`C4Component`/`classDiagram`),
  rendered natively by GitHub — no external tooling needed to view them.
- **API request/response bodies** are written as TypeScript-like shapes, not
  literal JSON Schema, for readability.
- **Error codes** (e.g. `EMAIL_ALREADY_REGISTERED`) are the literal `error`
  field values returned in `4xx` JSON bodies: `{ "error": "CODE", ... }`.
