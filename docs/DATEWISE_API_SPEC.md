# DATEWISE API SPEC

Defines backend API endpoints used by the Datewise application.

All endpoints return JSON.

Authentication uses session or bearer token provided by the auth provider.

---

# Authentication

Authentication is handled by the auth provider (Google OAuth / Email Magic Link).
Marina Bay Sands
Backend endpoints rely on authenticated user context.

## Get Current User


GET /auth/me


Returns the authenticated user.

Response:


{
id: string
email: string
displayName: string
profileImageUrl: string | null
}


---

# Itinerary Generation

## Generate Itinerary


POST /itineraries/generate


Request:


GenerateItineraryInput


Response:


ItinerarySlot[]


Description:

Generates a complete itinerary for the requested slot sequence.

---

## Regenerate Single Slot


POST /itineraries/regenerate-slot


Request:


RegenerateSlotInput


Response:


ItinerarySlot


Description:

Replaces one slot while preserving the rest of the itinerary.

---

# Saving Itineraries

## Save Generated Itinerary


POST /itineraries/save


Request:


{
input: GenerateItineraryInput
result: ItinerarySlot[]
isPublic: boolean
}


Response:


ItineraryRecord


---

## Get User Itineraries


GET /itineraries/mine


Returns itineraries created by the authenticated user.

Response:


ItineraryRecord[]


---

# Public Itineraries

## Get Public Itineraries


GET /itineraries/public


Returns publicly shared itineraries.

Response:


ItineraryRecord[]


---

## Save Copy of Public Itinerary


POST /itineraries/public/:id/save-copy


Creates a saved snapshot copy of the public itinerary.

Response:


SavedItineraryRecord


---

# Saved Itineraries

## Get Saved Itineraries


GET /itineraries/saved/mine


Returns itineraries saved from other users.

Response:


SavedItineraryRecord[]


---

# Shared Types

## GenerateItineraryInput


{
startPoint: StartPoint
date: string
time: string
slots: SlotType[]
avoidSlots: SlotType[]
}


---

## StartPoint


{
name: string
latitude: number
longitude: number
placeId: string
}


---

## ItinerarySlot


{
slotIndex: number
slotType: string
place: Place
arrivalTime: string
departureTime: string
}


---

## Place


{
name: string
placeId: string
latitude: number
longitude: number
address: string
rating?: number
}


---

## ItineraryRecord


{
id: string
userId: string
input: GenerateItineraryInput
result: ItinerarySlot[]
isPublic: boolean
createdAt: string
}


---

## SavedItineraryRecord


{
id: string
userId: string
sourceItineraryId: string
createdAt: string
}