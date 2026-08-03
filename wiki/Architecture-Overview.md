# Architecture Overview

This wiki's technical documentation is the source of truth for how PHR is built. It's organized into four areas, described below.

## Architecture (C4 model)

| Level | Page | What it shows |
|---|---|---|
| C1 | [System Context](C1-System-Context) | PHR as a black box, its users, and the one external system it talks to |
| C2 | [Container](C2-Container) | The deployable pieces — web app, mobile app, API service, database, media storage — and how they talk to each other |
| C3 | [Component](C3-Component) | Inside the API service: route modules, the auth plugin, storage/thumbnail/OCR modules |
| C4 | [Code](C4-Code) | A code-level class view of the Records domain, the most structurally representative slice of the system |

## API Reference

[**Full REST API reference**](API-Reference) — every route in `apps/api`, grouped by resource (auth, users, families, approvals, records, files), with request/response shapes, status codes, and error codes.

## Data Model

[**Data model & ERD**](Data-Model) — the Prisma schema: every table, field, relation, and the two constraints worth knowing about before you touch the schema (the partial unique index on family names, and the 1:1 patient↔user link).

## App & service guides

| Guide | Covers |
|---|---|
| [Web app](Web-App) | Next.js app: pages, routing, auth/session handling, theming |
| [Mobile app](Mobile-App) | Expo/React Native app: navigation shell, screens, native integrations |
| [Backend service](Backend-Service) | Fastify API internals: auth, file storage, thumbnails, OCR, signed URLs |
| [Shared package](Shared-Package) | `@phr/shared` — the typed API clients and zod schemas both apps build on |
| [Deployment](Deployment) | Docker images, `docker-compose.yml`, environment variables, known build gotchas |

## Repository layout

```
apps/
  api/      Fastify + Prisma + PostgreSQL backend
  web/      Next.js 14 (App Router) frontend
  mobile/   Expo / React Native app
packages/
  shared/   Typed API clients + zod schemas, consumed by web and mobile
docs/       Source of this wiki
```

## Project history & specs

This wiki is the detailed, living technical reference. For *how the project got here* — the original discovery doc, the delivered MVP scope, and slice-by-slice acceptance criteria — see [Feature Slices](Feature-Slices):

- [Requirements and Project Plan](Requirements-and-Project-Plan) — original discovery/planning doc (historical)
- [MVP Spec](MVP-Spec) — delivered MVP v1.0 scope
- [Technical Design](Technical-Design) — concise as-built architecture summary (this wiki is the expanded version)
- [Feature Slices](Feature-Slices) — one doc per delivered feature slice, with acceptance criteria
