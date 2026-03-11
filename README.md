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
- API contracts are documented in `docs/04_API_SPEC.md`.


## Guest generation
- Users can generate/regenerate itineraries without logging in.
- Saving itineraries (own/public copy) still requires login.

## Persistence recommendation
- Current local dev uses in-memory users/itineraries.
- For production and admin visibility of users, use PostgreSQL (via Prisma schema in `apps/api/prisma/schema.prisma`) and optionally Supabase Postgres as the managed DB.
- Supabase Auth can still be used as identity provider, but the app should persist user records in its own DB tables for queryability/auditing.
