# Datewise API Spec

## Auth
- `POST /auth/signup` `{ email, password, displayName }` -> `{ token, user }` (legacy local fallback)
- `POST /auth/login` `{ email, password }` -> `{ token, user }` (legacy local fallback)
- `GET /auth/me` with `Authorization: Bearer <token>` -> `{ id, email, displayName, profileImage }`
- `GET /auth/profile` with `Authorization: Bearer <token>` -> `{ user, itineraries, saved }`

> `Bearer` token can be either legacy local token or Supabase access token. Supabase validation is performed against `/auth/v1/user`.

## Itineraries
- `POST /itineraries/generate` with shared `GenerateItineraryInput` -> `ItinerarySlot[]`
- `POST /itineraries/regenerate-slot` with shared `RegenerateSlotInput` -> `ItinerarySlot`
- `POST /itineraries/save` `{ input: GenerateItineraryInput, isPublic: boolean }` -> `ItineraryRecord`
- `GET /itineraries/mine` -> own itineraries
- `GET /itineraries/public` -> public itineraries
- `POST /itineraries/public/:id/save-copy` -> snapshot copy in saved list
- `GET /itineraries/saved/mine` -> saved copies
