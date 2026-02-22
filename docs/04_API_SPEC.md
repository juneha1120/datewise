# API Spec (v1)

## GET /v1/places/autocomplete
Query
- `q`: string (required, min length 2, max length 120)

Response
```json
{
  "suggestions": [
    {
      "placeId": "string",
      "primaryText": "string",
      "secondaryText": "string"
    }
  ]
}
```

## GET /v1/places/details
Query
- `placeId`: string (required, non-empty)

Response
```json
{
  "placeId": "string",
  "name": "string",
  "formattedAddress": "string",
  "lat": 1.300,
  "lng": 103.800,
  "types": ["string"]
}
```


Provider notes
- `/v1/places/autocomplete`, `/v1/places/details`, and `/v1/places/debug/candidates` are backed by Google Places API (Autocomplete + Place Details + Nearby Search).
- Requests are restricted to Singapore (`country=SG`) with Singapore proximity bias.
- External calls use timeout <= 5s and max 2 retries.
- Candidate tags are deterministic heuristic labels from place types, price level, and snippets (e.g. `ARTSY`, `ROMANTIC`, `LOUD`).


## GET /v1/places/debug/candidates
Query
- `originPlaceId`: string (required, non-empty)

Response
```json
{
  "originPlaceId": "string",
  "candidates": [
    {
      "kind": "PLACE|EVENT",
      "externalId": "string",
      "name": "string",
      "lat": 1.3,
      "lng": 103.8,
      "address": "string",
      "rating": 4.5,
      "reviewCount": 1200,
      "priceLevel": 2,
      "types": ["cafe", "restaurant"],
      "tags": ["COZY", "DATE_NIGHT", "BUDGET_FRIENDLY"]
    }
  ]
}
```

## POST /v1/itineraries/generate
Request
{
  "origin": {
    "placeId": "string",
    "name": "string",
    "formattedAddress": "string",
    "lat": 1.300,
    "lng": 103.800,
    "types": ["string"]
  },
  "date": "YYYY-MM-DD",
  "startTime": "HH:mm",
  "durationMin": 120,
  "budget": "$|$$|$$$",
  "dateStyle": "FOOD|ACTIVITY|EVENT|SCENIC|SURPRISE",
  "vibe": "CHILL|ACTIVE|ROMANTIC|ADVENTUROUS",
  "food": ["VEG","HALAL_FRIENDLY","NO_ALCOHOL","NO_SEAFOOD"], // optional
  "avoid": ["OUTDOOR","PHYSICAL","CROWDED","LOUD"], // optional
  "transport": "MIN_WALK|TRANSIT|DRIVE_OK|WALK_OK" // optional
}

Response
{
  "itineraryId": "uuid",
  "stops": [
    {
      "kind": "PLACE|EVENT",
      "name": "string",
      "lat": 1.0,
      "lng": 103.0,
      "address": "string",
      "url": "string",
      "rating": 4.6,
      "reviewCount": 1200,
      "priceLevel": 2,
      "tags": ["CHILL","DATE_NIGHT"],
      "reason": "string"
    }
  ],
  "legs": [
    { "from": 0, "to": 1, "mode": "WALK|TRANSIT|DRIVE", "durationMin": 12, "distanceM": 850 }
  ],
  "totals": { "durationMin": 180, "walkingDistanceM": 1200 },
  "meta": { "usedCache": true, "warnings": [] }
}

## POST /v1/itineraries/{id}/swap
Request
{ "stopIndex": 1, "strategy": "SIMILAR|CLOSER|CHEAPER" }

## GET /v1/itineraries/{id}
Returns saved snapshot itinerary

## (Phase 2) POST /v1/itineraries/{id}/publish
## (Phase 2) POST /v1/public/{id}/like
## (Phase 2) GET /v1/public/feed?area=...

- Backend requires `GOOGLE_MAPS_API_KEY` in repository root `.env` (or `.env.local`).
