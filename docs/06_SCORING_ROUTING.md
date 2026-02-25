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

## Deterministic scoring engine (V1)
`ScoringService` ranks each candidate with deterministic, explainable components and no external calls:

- `QualityScore` (0..1)
  - `ratingScore = rating/5`
  - `confidenceScore = log10(reviewCount + 1) / 3`
  - combined as `0.7 * ratingScore + 0.3 * confidenceScore`
- `FitScore` (0..1)
  - distance approximation via haversine from origin to candidate
  - transport distance cap: `MIN_WALK=800`, `TRANSIT=2000`, `WALK_OK=4000`, `DRIVE_OK=6000`
  - budget fit by absolute gap between requested budget level and `priceLevel`
  - combined as `0.75 * distanceScore + 0.25 * budgetScore`
- `StyleVibeScore` (0..1)
  - deterministic keyword/tag overlap against style + vibe signal dictionaries
- `AvoidPenalty` (0..1)
  - fraction of selected avoid filters that match candidate tags/types
- `DiversityPenalty` (0..1)
  - penalty when candidate repeats tags/types already picked in `selected`

### Weighted total (bounded)

```
TotalScore =
  + 0.30 * QualityScore
  + 0.30 * FitScore
  + 0.25 * StyleVibeScore
  - 0.10 * AvoidPenalty
  - 0.05 * DiversityPenalty
```

Tie-breakers are deterministic: higher total score, then shorter distance, then lexicographic external id.

## Itinerary assembly (greedy + validation)
1) Pick an "anchor" matching dateStyle (e.g., FOOD -> dinner place)
2) Expand with nearby complementary stops
3) Validate each leg with Directions
4) If invalid, backtrack and try next candidate
5) Stop count determined by duration:
   - 2h: 2 stops
   - 3h: 3 stops
   - 4h: 3–4 stops
