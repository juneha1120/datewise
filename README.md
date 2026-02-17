# Datewise (Singapore-only V1)

Datewise generates a curated date itinerary (2–4 stops) for couples in Singapore based on start MRT/area, time window, walking tolerance, budget, date style, and vibe. It integrates Google Places + Directions for venues/routes and Eventbrite for events.

## Project Goal
- Singapore-only itinerary generation for couples.
- V1 focus: deterministic, high-quality planning and shareable itineraries.

## Monorepo structure
- `apps/web`: Next.js + TypeScript frontend
- `apps/api`: NestJS + TypeScript backend
- `packages/shared`: shared types and Zod schemas

## Planned Stack
- Web: Next.js + TypeScript + Tailwind + shadcn/ui + TanStack Query
- API: NestJS + TypeScript + Prisma
- Data: Postgres (persistence), Redis (cache + rate limiting)

## Planned External APIs
- Google Places API (places, details, photos, reviews)
- Google Directions API (routing + walking distance)
- Google Geocoding API (MRT/area to lat/lng when needed)
- Eventbrite API (events near coordinates + time window)

## Local Setup (Scaffold)
1) Copy env:
   - `cp .env.example .env`
2) Install dependencies:
   - `npm install`
3) Start both apps:
   - `npm run dev`

### Run apps individually
- Web: `npm run dev:web`
- API: `npm run dev:api`

## Roadmap (V1)
- Input capture and validation
- Candidate discovery + normalization
- Dynamic tagging heuristics
- Scoring and itinerary assembly
- Reroll/swap, persistence, and caching

## Current status
- Monorepo/workspaces scaffold is in place.
- No external API integrations yet.
- No business logic yet.

## Docs
See `/docs` for product, requirements, API, scoring, data model, and runbook.

## Security
All external API keys are backend-only. Frontend never calls external APIs directly.
