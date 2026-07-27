# Personal Health Record (PHR)

A self-hosted, open-source personal health record platform for individuals and families to store, organize, and review medical documents in one place.

The goal of this project is to make health records easier to manage by keeping prescriptions, lab reports, bills, and notes in a single place that can be viewed in a timeline. It is designed for both a web dashboard and a mobile app, with privacy-focused family sharing controls.

## Project goal

This project aims to provide a simple and trustworthy way to keep personal and family medical records together without relying on a proprietary cloud service. Users can capture or upload documents, attach them to a patient profile, and browse them chronologically over time.

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

## Architecture

This repository uses a TypeScript monorepo with shared contracts across the stack:

- API: Node.js, TypeScript, Fastify, Prisma, PostgreSQL
- Web app: Next.js, React, Material UI
- Mobile app: Expo, React Native
- Storage: MinIO/S3-compatible object storage for uploaded files

### Repository layout

- apps/api — backend API and business logic
- apps/web — web dashboard
- apps/mobile — mobile client
- packages/shared — shared schemas, types, and API helpers
- docs — product requirements, specs, and implementation design

## Getting started

### Prerequisites

- Node.js 20+
- Docker Desktop (for PostgreSQL and MinIO)
- npm

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

### 3. Start local services

```bash
docker compose up -d
```

This starts PostgreSQL and MinIO for local development.

### 4. Run database migrations

```bash
cd apps/api
npx prisma migrate deploy
npx prisma generate
```

### 5. Build the shared package

```bash
npm run build:shared
```

### 6. Start the apps

In separate terminals:

```bash
npm run dev:api
npm run dev:web
```

Optional mobile app:

```bash
npm run dev:mobile
```

The API defaults to http://localhost:4000 and the web app to http://localhost:3000.

## Testing

```bash
npm run test:api
```

## Documentation

The implementation and product requirements are documented in:

- [docs/requirements-and-project-plan.md](docs/requirements-and-project-plan.md)
- [docs/specs/mvp-spec.md](docs/specs/mvp-spec.md)
- [docs/specs/technical-design.md](docs/specs/technical-design.md)

## Current status

This repository contains the MVP v1.0 implementation of the project.
