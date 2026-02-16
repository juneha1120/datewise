# AGENTS.md (Datewise)

## Project goals
- Singapore-only itinerary generator using Google Places/Directions + Eventbrite
- Keep UX simple; keep backend deterministic and testable

## How to work in this repo
- Prefer small PRs per feature (1 endpoint or 1 module at a time)
- Never change API schemas without updating docs/04_API_SPEC.md and packages/shared schemas

## Code standards
- TypeScript strict; no `any`
- Use Zod for validation (shared package)
- External API calls must be wrapped with:
  - timeout <= 5s
  - retries <= 2
  - structured error mapping

## Must-have behaviors
- Cache before calling Google/Eventbrite
- Never expose API keys to the web app
- If Eventbrite fails: return places-only + warning

## Testing
- Unit tests required for:
  - tagging heuristics
  - scoring function
  - itinerary assembly edge cases
- Mock external APIs in tests
