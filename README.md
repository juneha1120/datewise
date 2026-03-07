# Datewise MVP

Datewise is a Singapore-only itinerary generator. This repository is organized as:

- `apps/web`: Next.js web client
- `apps/api`: NestJS API
- `packages/shared`: shared taxonomy, validation schemas, and conflict helpers

## Quick start

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy envs:
   ```bash
   cp .env.example .env
   ```
3. Run API and web:
   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev`
- `npm run build`
- `npm run typecheck`
- `npm run test`

## MVP notes

- Google OAuth is implemented as backend contract endpoint (`/auth/google`) that accepts a verified profile payload.
- Place search is deterministic provider scaffolding to keep generator behavior stable and testable.
- `apps/api/prisma/schema.prisma` is included as the target PostgreSQL data model for production persistence.
- Current runtime persistence in the API is in-memory (`apps/api/src/db.ts`) for local MVP iteration.
