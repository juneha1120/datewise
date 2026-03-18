# DATEWISE SYSTEM SPECIFICATION

**Version:** MVP v1  
**Product:** Datewise  
**Scope:** Singapore-only web application for generating date itineraries.

---

# 1. Product Overview

## 1.1 Product Definition

Datewise is a web application that automatically generates date itineraries based on:

- a starting location
- date and time
- user preferences for activity types

The system builds an ordered sequence of **2–4 destinations** such as restaurants, activities, and drink locations while ensuring:

- places match user preferences
- places are open during the visit
- travel time between locations is reasonable
- nearby locations are preferred

The system generates **one itinerary** with options to regenerate.

---

# 2. Product Scope

## 2.1 Geographic Scope

Datewise is **Singapore-only**.

All generated places must be located in **Singapore**.

---

## 2.2 Supported Platforms

MVP supports:

- Desktop web browser
- Mobile web browser

Not supported:

- Native mobile applications

---

## 2.3 Target User

Individuals planning a **date or outing** who want a **simple automatically generated plan**.

---

# 3. Core User Journeys

## 3.1 Generate an Itinerary

User flow:

1. User opens itinerary builder
2. User sets starting location
3. User optionally adjusts date/time
4. User selects desired slot types
5. User optionally adds avoided slot types
6. User clicks **Generate**
7. System returns a sequence of places
8. User can **regenerate** or **save itinerary**

---

## 3.2 Save an Itinerary

User flow:

1. User generates itinerary
2. User clicks **Save**
3. Itinerary stored under user profile

---

## 3.3 Browse Public Itineraries

User flow:

1. User opens **Public Itineraries**
2. System lists public itineraries
3. User views one
4. User may save it to their own account

---

# 4. Authentication

## 4.1 Supported Login Methods

The system supports:

- Google OAuth
- Email login

Email login may be implemented using **passwordless magic link**.

---

## 4.2 User Profile Fields

Each user has:


id
displayName
email
profileImageUrl
createdAt
updatedAt


---

## 4.3 Authenticated Features

Only authenticated users may:

- save itineraries
- view saved itineraries
- save public itineraries

---

# 5. Itinerary Builder

## 5.1 Starting Point

Users select starting location using:

- Google Maps Autocomplete Search

Optional feature:

- **Use Current Location** button using browser geolocation.

Stored data:


name
latitude
longitude
placeId


---

## 5.2 Date

Default:


today


User may adjust.

---

## 5.3 Time

Default:


current time


User may adjust.

---

# 6. Slot System

## 6.1 Definition

A **slot** represents a destination in the itinerary.


1 slot = 1 place


---

## 6.2 Slot Count

Default:


3 slots


Minimum:


2 slots


Maximum:


4 slots


Users may add/remove slots within these bounds.

---

## 6.3 Slot Order

Slots are ordered.

Users may **reorder slots using drag-and-drop**.

Generation respects slot order.

---

# 7. Slot Categories

Slots belong to **core groups** or **subgroups**.

---

## 7.1 Core Groups


EAT
DO
SIP


---

## 7.2 Subgroups

### EAT


JAPANESE
KOREAN
CHINESE
THAI
WESTERN
ITALIAN
INDIAN
MALAY
INDONESIAN
VIETNAMESE
MIDDLE_EASTERN
SEAFOOD
LOCAL
HAWKER


---

### DO


MUSEUM
GALLERY
EXHIBITION
SHOPPING
WELLNESS
CINEMA
CLASSES
WALK_IN_PARK
SCENIC_WALK
ARCADE
BOWLING
KARAOKE
ESCAPE_ROOM
INDOOR_SPORTS
OUTDOOR_ACTIVITY
ATTRACTION


---

### SIP


COFFEE
DESSERT
BUBBLE_TEA
TEA_HOUSE
COCKTAIL
WINE
BEER
SPIRIT


---

# 8. Slot Matching Rules

## 8.1 Core Group Selection

If a slot uses a core group:

Example:


EAT


System may choose **any subgroup under EAT**.

---

## 8.2 Subgroup Selection

If a slot uses a subgroup:

Example:


JAPANESE


System should **strongly prefer places matching that subgroup**.

---

# 9. Avoid Slots

Users may add **avoided categories**.

Avoid supports:

- core groups
- subgroups

---

## 9.1 Avoid Subgroup

Avoiding a subgroup removes only that subgroup.

Example:


avoid: JAPANESE


Only Japanese places are excluded.

---

## 9.2 Avoid Core Group

Avoiding a core group excludes all subgroups under it.

Example:


avoid: EAT


All restaurant subgroups excluded.

---

## 9.3 Conflict Rules

If an included slot conflicts with avoided types:

**Generation must not run.**

Example:


include: JAPANESE
avoid: JAPANESE


Result:


Validation error


---

# 10. Slot Duration

Estimated duration per core group:


EAT = 90 minutes
SIP = 90 minutes
DO = 120 minutes


These durations are used to calculate arrival and departure times.

---

# 11. Itinerary Generation Rules

## 11.1 Input

Generator input contains:


startPoint
date
time
slots[]
avoidSlots[]


---

## 11.2 Generation Strategy

For each slot in order:

1. Determine category requirement
2. Search candidate places
3. Filter by:
   - category match
   - opening hours
   - avoid rules
4. Rank candidates
5. Select best candidate
6. Calculate travel to next slot

---

# 12. Place Search

Primary search uses:


Google Places API


Endpoints used:


Text Search
Place Details


---

## 12.1 Category Verification

Verification priority:

1. text search relevance
2. place type/category
3. review keywords

---

# 13. Opening Hours Validation

Place must satisfy:


arrivalTime >= openingTime
departureTime <= closingTime


Where:


departureTime = arrivalTime + slotDuration


Places failing this condition are excluded.

---

# 14. Distance Preference

Candidate ranking prioritizes:

1. valid category match
2. open for required duration
3. shortest travel time from previous place

---

# 15. Search Radius Expansion

Candidate search radius expands if needed:


3 km → 5 km → 8 km


Expansion occurs if insufficient candidates are found.

---

# 16. Travel Time Calculation

Travel time between locations must be calculated.

Preferred method:


Google Directions API


Fallback:


distance-based estimate


---

# 17. Regeneration

## 17.1 Regenerate All

Re-runs the entire generation process.

---

## 17.2 Regenerate One Slot

Only the selected slot is replaced.

Adjacent travel times must be recalculated.

---

# 18. Itinerary Data Storage

Each itinerary stores **both input and output**.

---

## 18.1 Stored Input


startPoint
date
time
selectedSlots
avoidSlots


---

## 18.2 Stored Results


places[]
travelLegs[]
arrivalTimes[]
departureTimes[]


---

## 18.3 Metadata


createdAt
updatedAt
editedAfterGeneration
isPublic
sourceItineraryId


---

# 19. Public Itineraries

Users may **publish itineraries**.

Public itineraries are visible to all users.

---

## 19.1 Saving Public Itineraries

When a user saves a public itinerary:


userId
sourceItineraryId


Saved copy must remain viewable even if original changes.

---

# 20. Pages

Required pages:


Home
Login
Profile
Generate Itinerary
Itinerary Result
Saved Itineraries
Public Itineraries
Itinerary Detail


---

# 21. System Architecture

Preferred architecture:


Frontend: Next.js
Backend: NestJS
Database: PostgreSQL
ORM: Prisma
Styling: Tailwind


---

# 22. Backend Modules

Recommended modules:


auth
users
itineraries
generator
places
public-itineraries


---

# 23. Shared Domain Logic

Shared definitions should exist for:


slot taxonomy
durations
validation helpers
generator types


---

# 24. Environment Variables

Required variables:


DATABASE_URL
GOOGLE_MAPS_API_KEY
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
AUTH_SECRET
NEXTAUTH_URL


---

# 25. Non Functional Requirements

System should:

- be strongly typed
- follow modular architecture
- avoid duplicated logic
- validate all inputs
- handle external API failures
- have minimal dead code
- pass lint and typecheck

---

# 26. Out of Scope

MVP does **NOT** include:


budget filtering
weather-based suggestions
AI chat planner
real-time collaboration
complex route optimization
native mobile apps


---

# 27. Acceptance Criteria

The MVP is complete when:

- users can authenticate
- users can generate itineraries
- places match slot preferences
- places are open during visit
- travel legs are calculated
- itineraries can be saved
- public itineraries can be browsed
- regenerate functions work
- validation prevents invalid slot conflicts

---

# 28. Version


Datewise System Specification
Version: MVP v1