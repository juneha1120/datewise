# Runbook

## Dev commands (root)
- npm run dev: start web + api
- npm run test: run all tests
- npm run lint: lint all packages

## Common failures
- Google quota exceeded -> verify caching + reduce candidate count
- Eventbrite timeout -> fallback to places-only and return warning

## Debugging
- Enable debug logs in API with LOG_LEVEL=debug
- Inspect Redis keys for cache hit rate

npm audit reports vulnerabilities in dev tooling via @nestjs/cli; not force-upgraded during scaffold to avoid breaking changes. Revisit before production.