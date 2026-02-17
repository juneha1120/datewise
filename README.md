# Datewise (Singapore-only V1)

Datewise generates a curated date itinerary (2–4 stops) for couples in Singapore based on start MRT/area, time window, walking tolerance, budget, date style, and vibe. It integrates Mapbox Search for origin lookup, Google Places + Directions for venues/routes, and Eventbrite for events.

## Tech Stack
- Web: Next.js + TypeScript + Tailwind + shadcn/ui + TanStack Query
- API: NestJS + TypeScript + Prisma
- Data: Postgres (persistence), Redis (cache + rate limiting)

## External APIs
- Mapbox Search API (origin autocomplete + place details; Singapore-only filter)
- Google Places API (places, details, photos, reviews)
- Google Directions API (routing + walking distance)
- Google Geocoding API (MRT/area to lat/lng when needed)
- Eventbrite API (events near coordinates + time window)

## Local Setup
1) Copy env:
   - cp .env.example .env
2) Start dependencies (recommended):
   - docker compose up -d (or run Postgres + Redis locally)
3) Install:
   - npm install
4) Run:
   - npm run dev

## Docs
See /docs for product, requirements, API, scoring, data model, and runbook.

## Security
All external API keys are backend-only. Frontend never calls external APIs directly.


## Environment
- `MAPBOX_ACCESS_TOKEN` is required for `/v1/places/autocomplete` and `/v1/places/details` (API only; never expose it to the web app).
