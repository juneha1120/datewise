# Datewise API Spec

## Auth
- `POST /auth/signup` `{ email, password, displayName }` -> `{ token, user }`
- `POST /auth/login` `{ email, password }` -> `{ token, user }`
- `POST /auth/google` `{ email, displayName, profileImage? }` -> `{ token, user }`
- `GET /auth/me` header `Authorization: Bearer <token>` -> `{ id, email, displayName, profileImage }`
- `GET /auth/profile` header `Authorization: Bearer <token>` -> `{ user, itineraries, saved }`

## Itineraries
- `POST /itineraries/generate` with shared `GenerateItineraryInput` -> `ItinerarySlot[]`
- `POST /itineraries/regenerate-slot` with shared `RegenerateSlotInput` -> `ItinerarySlot`
- `POST /itineraries/save` `{ input: GenerateItineraryInput, isPublic: boolean }` -> `ItineraryRecord`
- `GET /itineraries/mine` -> own itineraries
- `GET /itineraries/public` -> public itineraries
- `POST /itineraries/public/:id/save-copy` -> snapshot copy in saved list
- `GET /itineraries/saved/mine` -> saved copies
