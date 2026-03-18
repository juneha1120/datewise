# Datewise MVP

Datewise is a Singapore-only itinerary generator.

## Monorepo layout
- `apps/web`: Next.js frontend (separated pages: login/planner/profile/public)
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

## Auth behavior
- Frontend primary auth uses Datewise API endpoints (`/auth/signup`, `/auth/login`) for local email/password flows.
- API uses in-memory users in local dev; if the API restarts, sign in again to refresh session state.
- API can also validate Supabase bearer tokens via `/auth/v1/user` when Supabase env vars are configured.

## Google location autocomplete
- Planner start-point search uses Google Places Autocomplete + Place Details (Singapore-only filter).
- Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in `.env` to enable autocomplete in the web app.

## Notes
- Backend currently uses deterministic in-memory persistence for local iteration in `apps/api/src/db.ts`.
- Production target PostgreSQL schema is available at `apps/api/prisma/schema.prisma`.
- Product/system specification is maintained in `docs/DATEWISE_SYSTEM_SPEC.md`.
- API contracts are documented in `docs/DATEWISE_API_SPEC.md`.
