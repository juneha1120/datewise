# Datewise MVP

Datewise is a Singapore-only itinerary generator.

## Monorepo layout
- `apps/web`: Next.js frontend
- `apps/api`: NestJS API
- `packages/shared`: taxonomy, validation, and conflict helpers

## Run locally
```bash
npm install
cp .env.example .env
npm run dev
```

## Quality checks
```bash
npm run typecheck
npm run test
npm run build
```

## Notes
- Backend currently uses deterministic in-memory persistence for local iteration in `apps/api/src/db.ts`.
- Production target PostgreSQL schema is available at `apps/api/prisma/schema.prisma`.
- API contracts are documented in `docs/04_API_SPEC.md`.
