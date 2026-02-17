# Security & Privacy

- All external API keys are backend-only.
- Frontend calls only Datewise API endpoints.
- Validate requests with shared Zod schemas.
- Rate limit generate/swap endpoints.
- Do not store precise user location unless explicitly used (store MRT/area label where possible).
- Log redaction: never log full request bodies containing lat/lng at info level.