# Datewise Overview

## Scope
Singapore-only itinerary generation for couples. V1 focuses on high-quality planning and shareable itineraries.

## Core outputs
- 2–4 stop itinerary with:
  - stop reasons ("why this fits")
  - route legs (duration, distance, mode)
  - totals (time + walking distance)
- Reroll itinerary
- Swap one stop while keeping constraints

## Data strategy
Dynamic categorization using Google Places + Eventbrite content + lightweight heuristics, then caching derived tags/scores.
No manual pre-tag database required for V1.