# Scoring & Routing

## Walking thresholds (V1)
- MIN_WALK: <= 800m
- TRANSIT / default: <= 2000m
- WALK_OK: <= 4000m

## Candidate schema
Candidate = PLACE or EVENT with:
- coords
- time suitability info (opening hours or event time)
- quality (rating, count)
- tags inferred (vibe/date signals)

## Tagging heuristics (no heavy AI in V1)
Place tags inferred from:
- Google "types"
- price_level
- review keyword hits (limited reviews)
Event tags inferred from:
- category
- title/description keywords

## Scoring outline
TotalScore =
  + FitScore (distance, time, constraints)
  + QualityScore (rating weighted by count)
  + StyleVibeScore (match)
  + DateSignalScore (romantic/cozy/date-night keywords)
  - SimilarityPenalty (avoid repeats)
  - TravelPenalty (long transit legs)

## Itinerary assembly (greedy + validation)
1) Pick an "anchor" matching dateStyle (e.g., FOOD -> dinner place)
2) Expand with nearby complementary stops
3) Validate each leg with Directions
4) If invalid, backtrack and try next candidate
5) Stop count determined by duration:
   - 2h: 2 stops
   - 3h: 3 stops
   - 4h: 3–4 stops
