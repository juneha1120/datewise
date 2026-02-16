# Data Model (Prisma/Postgres)

## Core
itinerary
- id (uuid)
- createdAt
- input jsonb
- totals jsonb
- warnings text[]
- isPublished boolean (phase 2)

itinerary_stop
- itineraryId (fk)
- idx int
- kind enum (PLACE|EVENT)
- externalId text (googlePlaceId or eventbriteId)
- snapshot jsonb  (stable copy: name, coords, rating, url, tags, reason)

itinerary_leg
- itineraryId (fk)
- fromIdx int
- toIdx int
- mode enum
- durationMin int
- distanceM int

## Cache tables (optional; Redis first, Postgres optional)
cache_place
- placeId text pk
- payload jsonb
- expiresAt

cache_event
- eventId text pk
- payload jsonb
- expiresAt

cache_directions
- key text pk (hash of origin+dest+mode+timebucket)
- payload jsonb
- expiresAt
