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
  "durationMin": 240,
  "budgetLevel": 1,
  "radiusMode": "WALKABLE|SHORT_TRANSIT|CAR_GRAB",
  "sequence": [
    { "type": "CORE", "core": "EAT" },
    { "type": "SUBGROUP", "subgroup": "MUSEUM" }
  ],
  "avoid": [
    { "type": "CORE", "core": "SIP" },
    { "type": "SUBGROUP", "subgroup": "SHOPPING" }
  ]
}
```

Success response
```json
{
  "status": "OK",
  "itineraryId": "string",
  "stops": [{ "name": "string", "core": "EAT", "subgroup": "JAPANESE", "matchConfidence": 0.82 }],
  "legs": [{ "from": 0, "to": 1, "mode": "TRANSIT", "durationMin": 12, "distanceM": 2000 }],
  "totals": { "durationMin": 240, "walkingDistanceM": 1200 },
  "meta": { "usedCache": false, "warnings": [], "totalTravelTimeMin": 36 }
}
```

Conflict response
```json
{
  "status": "CONFLICT",
  "reason": "NO_CANDIDATES_WITHIN_RADIUS|ONLY_CANDIDATES_TOO_FAR|ALL_BLOCKED_BY_AVOID|CLOSED_AT_TIME|INSUFFICIENT_TIME_FOR_TRAVEL",
  "message": "string",
  "suggestions": [
    { "type": "UPGRADE_RADIUS_MODE", "recommendedRadiusMode": "SHORT_TRANSIT", "message": "Try a wider radius mode." },
    { "type": "SUBSTITUTE_SUBGROUP", "slotIndex": 1, "fromSubgroup": "COFFEE", "toSubgroups": ["TEA_HOUSE"], "message": "Try nearby alternatives within the same core group." },
    { "type": "RECENTER_AROUND_SLOT", "slotIndex": 1, "message": "Recenter itinerary around the difficult slot." }
  ]
}
```

Behavior
- Sequence size is 2–5 slots. Each slot can be core-based or subgroup-specific.
- Avoid list supports only core and subgroup items; core avoid blocks all child subgroups.
- Radius mode constraints:
  - WALKABLE: max leg 1km, walking.
  - SHORT_TRANSIT: max leg 5km, transit with walking fallback.
  - CAR_GRAB: max leg 15km, driving.
- Global cap: total travel time must be <= 25% of `durationMin`, else conflict.
- Stage A retrieval keeps up to 20 candidates.
- Stage B verification fetches details for top 10 and applies match confidence threshold (`>= 0.6`), forbidden primary type checks, and open-hours checks.
- Open-hours are evaluated against the requested future `date` + computed arrival time using weekly periods from Place Details (`regularOpeningHours.periods`) as best-effort. Unknown opening-hours are penalized (`openScore = 0.7`); closed places are hard-rejected.
- Scoring formula:
  - `0.30*distanceScore + 0.20*qualityScore + 0.15*budgetFitScore + 0.15*openScore + 0.20*matchConfidence`

## Runtime requirements
- `GOOGLE_MAPS_API_KEY` in repo root `.env`.
- Enabled APIs: Google Places API (New), Directions API.
- External API calls use timeout <= 5s and retries <= 2 with structured error mapping.
