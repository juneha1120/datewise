# Requirements

## Functional Requirements

FR-1 Inputs
- Required: start (MRT/area/loc), date+start time+duration, budget, date style, vibe
- Optional: food constraints, avoid filters, transport preference

FR-2 Candidate discovery
- Fetch places via Google Places (nearby/text + details)
- Fetch events via Eventbrite near coordinates/time window
- Normalize to internal Candidate schema

FR-3 Derived tagging (dynamic categorization)
- Infer: vibe tags, couple-friendliness, noise/crowd hints, cost hints
- Use:
  - place types + price_level (when present)
  - review keyword signals (limited subset)
  - event title/description/category signals

FR-4 Scoring
Score candidates by:
- constraint fit (distance/time/open hours)
- quality (rating + review_count)
- vibe/style alignment
- couple-friendly signals
- diversity (avoid 3 similar stops)

FR-5 Itinerary generation
- Produce 2–4 stops (based on duration)
- Validate legs using Directions API
- Ensure total walking distance <= threshold (by walking preference)
- Ensure within time window (opening hours/event times)

FR-6 Reroll & swap
- Reroll regenerates itinerary under same constraints
- Swap replaces a stop and re-validates route

FR-7 Persistence
- Save itinerary snapshot (stable sharing)
- Cache place/event/directions results to reduce API costs

## Non-functional Requirements
- NFR-1: Input validation on all API endpoints
- NFR-2: Secrets only on backend
- NFR-3: Rate limiting to prevent abuse
- NFR-4: Caching strategy with TTLs
- NFR-5: Observability (request IDs + structured logs)

## Acceptance tests (MVP)
- Bugis MRT, 7pm, 3h, Minimal walking -> itinerary totals walking within threshold
- Swap stop maintains constraints and returns valid legs
- Eventbrite failure still returns places-only itinerary (warning flag)
