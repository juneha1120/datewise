# Architecture

## Components
- Web (Next.js): UI, input form, itinerary display, map view
- API (NestJS): orchestration, scoring, itinerary assembly
- Postgres: saved itineraries + snapshots + derived tags cache
- Redis: query cache + rate limit + short TTL results

## API Modules (NestJS)
- InputModule: request validation, normalization to internal types
- GeoModule: convert MRT/area to lat/lng (can be static dataset for MRT)
- PlacesModule: Google Places client + caching
- EventsModule: Eventbrite client + caching
- RoutingModule: Directions client + caching
- TaggingModule: derive vibe/couple/noise signals from text/types
- ScoringModule: scoring + diversity penalties
- ItineraryModule: build + validate + swap
- SocialModule (Phase 2): public itineraries, likes, bookmarks

## Failover
- If Eventbrite fails: continue with places-only (meta.warnings += EVENT_SOURCE_DOWN)
- If Directions fails: fallback to coarse distance estimates (meta.warnings += ROUTE_ESTIMATED)
