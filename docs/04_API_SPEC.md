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

## POST /v1/itineraries/generate
Request
{
  "start": { "type": "MRT|AREA|LATLNG", "value": "string", "lat": 1.0, "lng": 103.0 },
  "date": "YYYY-MM-DD",
  "startTime": "HH:mm",
  "durationMin": 120,
  "budget": "$|$$|$$$",
  "dateStyle": "FOOD|ACTIVITY|EVENT|SCENIC|SURPRISE",
  "vibe": "CHILL|ACTIVE|ROMANTIC|ADVENTUROUS",
  "optional": {
    "food": ["VEG","HALAL_FRIENDLY","NO_ALCOHOL","NO_SEAFOOD"],
    "avoid": ["OUTDOOR","PHYSICAL","CROWDED","LOUD"],
    "transport": "MIN_WALK|TRANSIT|DRIVE_OK|WALK_OK"
  }
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
