# API Spec (v1)

## GET /v1/places/autocomplete
Query
- `q`: string (required, min length 2, max length 120)

## GET /v1/places/details
Query
- `placeId`: string (required, non-empty)

## GET /v1/places/debug/candidates
Query
- `originPlaceId`: string (required, non-empty)

Behavior
- Uses Google Places Nearby Search with curated `includedTypes` only (no text-search fanout during initial candidate generation).
- Strictly filters candidates to within 2km of canonical origin coordinates.
- If typed Nearby Search returns 400 (unsupported type), retries without `includedTypes`.
- Candidate payload includes deterministic `tags` and `booking` signal (`BOOK_AHEAD`, `CHECK_AVAILABILITY`, `WALK_IN_LIKELY`).

---

## POST /v1/itineraries/generate
Request
```json
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
  "vibe": "CHILL|ROMANTIC|CREATIVE|PLAYFUL|ACTIVE|LUXE",
  "food": ["VEG","HALAL_FRIENDLY","NO_ALCOHOL","NO_SEAFOOD"],
  "avoid": ["OUTDOOR","PHYSICAL","CROWDED","LOUD"]
}
```

Response (excerpt)
```json
{
  "itineraryId": "string",
  "stops": [
    {
      "kind": "PLACE",
      "name": "string",
      "lat": 1.0,
      "lng": 103.0,
      "address": "string",
      "url": "string",
      "rating": 4.6,
      "reviewCount": 1200,
      "priceLevel": 2,
      "tags": ["COZY", "DATE_NIGHT"],
      "booking": { "score": 68, "label": "CHECK_AVAILABILITY" },
      "reason": "string"
    }
  ],
  "meta": {
    "usedCache": false,
    "warnings": [],
    "textSearchOptions": ["pottery workshop Singapore", "art workshop Singapore"]
  }
}
```

Behavior
- Canonical origin is resolved from `origin.placeId` before scoring/assembly.
- Candidate and routed-leg hard cap is 2km.
- `booking` is displayed per stop and **does not** affect scoring.
- Initial itinerary does not run text-search; instead `meta.textSearchOptions` is returned for optional post-generation replacement.

### Vibe mapping (must-include signals + itinerary design)
- `CHILL`: cafe/park/book_store + `COZY`/`NATURE`; combo aims for slow, low-noise flow (cafe → stroll/park → dessert).
- `ROMANTIC`: restaurant/bar/tourist_attraction + `ROMANTIC`/`DATE_NIGHT`; combo aims for intimate meal + scenic/photo stop.
- `CREATIVE`: art_gallery/museum/workshop-like signals + `ARTSY`; combo aims for hands-on or exhibition + cozy debrief stop.
- `PLAYFUL`: amusement_park/bowling_alley/arcade + `ICONIC`; combo aims for active game stop + casual food/chill stop.
- `ACTIVE`: park/natural_feature/tourist_attraction + `NATURE`; combo aims for outdoors movement + recovery stop.
- `LUXE`: fine-dining/bar/spa-like signals + `PREMIUM`; combo aims for premium dining/lounge sequence.

Tagging is derived from type + review snippets (e.g. `cozy`, `workshop`, `landmark`, `crowded`, `noisy`) and mapped to shared tags deterministically.

---

## POST /v1/itineraries/replace-stop-with-text-search
Request
```json
{
  "originPlaceId": "string",
  "stopIndex": 1,
  "query": "pottery workshop Singapore",
  "itinerary": { "...": "Generate response payload" }
}
```

Behavior
- Runs Google Places Text Search for selected query (biased near origin).
- Replaces one stop (by index) with best available result.
- Returns updated itinerary payload with warning entry in `meta.warnings`.

---

## Runtime requirements
- `GOOGLE_MAPS_API_KEY` in repo root `.env`.
- Enabled APIs: Google Places API (New) and Directions API.
- External API calls use timeout <= 5s and retries <= 2 with structured error mapping.
