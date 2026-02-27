import { z } from 'zod';

export const PlacesAutocompleteQuerySchema = z.object({
  q: z.string().min(2).max(120),
});

export const PlacesSuggestionSchema = z.object({
  placeId: z.string().min(1),
  primaryText: z.string().min(1),
  secondaryText: z.string().default(''),
});

export const PlacesAutocompleteResponseSchema = z.object({
  suggestions: z.array(PlacesSuggestionSchema),
});

export const PlaceDetailsQuerySchema = z.object({
  placeId: z.string().min(1),
});

export const PlaceDetailsResponseSchema = z.object({
  placeId: z.string().min(1),
  name: z.string().min(1),
  formattedAddress: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  types: z.array(z.string()),
});

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, 'Invalid date format. Use YYYY-MM-DD.');
const TimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/u, 'Invalid time format. Use HH:mm.');

export const BudgetSchema = z.enum(['$', '$$', '$$$']);

export const GenerateItineraryOriginSchema = PlaceDetailsResponseSchema;

export const CoreGroupSchema = z.enum(['EAT', 'DO', 'SIP']);
export const EatSubgroupSchema = z.enum([
  'JAPANESE',
  'KOREAN',
  'CHINESE',
  'THAI',
  'WESTERN',
  'ITALIAN',
  'INDIAN',
  'MALAY',
  'INDONESIAN',
  'VIETNAMESE',
  'MIDDLE_EASTERN',
  'SEAFOOD',
  'LOCAL',
  'HAWKER',
]);
export const DoSubgroupSchema = z.enum([
  'MUSEUM',
  'GALLERY',
  'EXHIBITION',
  'SHOPPING',
  'WELLNESS',
  'CINEMA',
  'CLASSES',
  'WALK_IN_PARK',
  'SCENIC_WALK',
  'ARCADE',
  'BOWLING',
  'KARAOKE',
  'ESCAPE_ROOM',
  'INDOOR_SPORTS',
  'OUTDOOR_ACTIVITY',
  'ATTRACTION',
]);
export const SipSubgroupSchema = z.enum(['COFFEE', 'DESSERT', 'BUBBLE_TEA', 'TEA_HOUSE', 'COCKTAIL', 'WINE', 'BEER', 'SPIRIT']);
export const SubgroupSchema = z.union([EatSubgroupSchema, DoSubgroupSchema, SipSubgroupSchema]);

export const SequenceSlotSchema = z.union([
  z.object({ type: z.literal('CORE'), core: CoreGroupSchema }),
  z.object({ type: z.literal('SUBGROUP'), subgroup: SubgroupSchema }),
]);

export const AvoidItemSchema = z.union([
  z.object({ type: z.literal('CORE'), core: CoreGroupSchema }),
  z.object({ type: z.literal('SUBGROUP'), subgroup: SubgroupSchema }),
]);

export const RadiusModeSchema = z.enum(['WALKABLE', 'SHORT_TRANSIT', 'CAR_GRAB']);


export const BookingLikelihoodSchema = z.enum(['BOOK_AHEAD', 'CHECK_AVAILABILITY', 'WALK_IN_LIKELY']);
export const BookingSignalSchema = z.object({
  score: z.number().int().min(0),
  label: BookingLikelihoodSchema,
});

export const CandidateSchema = z.object({
  kind: z.enum(['PLACE', 'EVENT']),
  externalId: z.string().min(1),
  name: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  address: z.string().min(1).optional(),
  rating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().int().min(0).optional(),
  priceLevel: z.number().int().min(0).max(4).optional(),
  types: z.array(z.string().min(1)).optional(),
  tags: z.array(z.string().min(1)).optional(),
  booking: BookingSignalSchema.optional(),
});

export const DebugPlaceCandidatesQuerySchema = z.object({
  originPlaceId: z.string().min(1),
});

export const DebugPlaceCandidatesResponseSchema = z.object({
  originPlaceId: z.string().min(1),
  candidates: z.array(CandidateSchema),
});

export const GenerateItineraryRequestSchema = z.object({
  origin: GenerateItineraryOriginSchema,
  date: DateSchema,
  startTime: TimeSchema,
  durationMin: z.number().int().min(30).max(1440),
  budgetLevel: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  radiusMode: RadiusModeSchema,
  sequence: z.array(SequenceSlotSchema).min(2).max(5),
  avoid: z.array(AvoidItemSchema).optional().default([]),
});

export const ItineraryStopSchema = z.object({
  kind: z.enum(['PLACE', 'EVENT']),
  name: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  address: z.string().min(1),
  url: z.string().min(1),
  rating: z.number().min(0).max(5),
  reviewCount: z.number().int().min(0),
  priceLevel: z.number().int().min(0).max(4),
  tags: z.array(z.string().min(1)),
  booking: BookingSignalSchema.optional(),
  reason: z.string().min(1),
  core: CoreGroupSchema.optional(),
  subgroup: SubgroupSchema.optional(),
  arrivalTime: TimeSchema.optional(),
  departTime: TimeSchema.optional(),
  matchConfidence: z.number().min(0).max(1).optional(),
});

export const ItineraryLegSchema = z.object({
  from: z.number().int().min(0),
  to: z.number().int().min(0),
  mode: z.enum(['WALK', 'TRANSIT', 'DRIVE']),
  durationMin: z.number().int().min(1),
  distanceM: z.number().int().min(1),
});

export const ItineraryTotalsSchema = z.object({
  durationMin: z.number().int().min(1),
  walkingDistanceM: z.number().int().min(0),
});

export const GenerateItineraryResponseSchema = z.object({
  status: z.literal('OK').default('OK'),
  itineraryId: z.string().min(1),
  stops: z.array(ItineraryStopSchema),
  legs: z.array(ItineraryLegSchema),
  totals: ItineraryTotalsSchema,
  meta: z.object({
    usedCache: z.boolean(),
    warnings: z.array(z.string()),
    totalTravelTimeMin: z.number().int().min(0).optional(),
  }),
});

export const ItineraryConflictReasonSchema = z.enum([
  'NO_CANDIDATES_WITHIN_RADIUS',
  'ONLY_CANDIDATES_TOO_FAR',
  'ALL_BLOCKED_BY_AVOID',
  'CLOSED_AT_TIME',
  'INSUFFICIENT_TIME_FOR_TRAVEL',
]);

export const ConflictSuggestionSchema = z.object({
  type: z.enum(['UPGRADE_RADIUS_MODE', 'SUBSTITUTE_SUBGROUP', 'RECENTER_AROUND_SLOT']),
  message: z.string().min(1),
  slotIndex: z.number().int().min(0).optional(),
  fromSubgroup: SubgroupSchema.optional(),
  toSubgroups: z.array(SubgroupSchema).optional(),
  recommendedRadiusMode: RadiusModeSchema.optional(),
});

export const GenerateItineraryConflictResponseSchema = z.object({
  status: z.literal('CONFLICT'),
  reason: ItineraryConflictReasonSchema,
  message: z.string().min(1),
  suggestions: z.array(ConflictSuggestionSchema),
});

export const GenerateItineraryResultSchema = z.union([GenerateItineraryResponseSchema, GenerateItineraryConflictResponseSchema]);


export type PlacesAutocompleteQuery = z.infer<typeof PlacesAutocompleteQuerySchema>;
export type PlacesSuggestion = z.infer<typeof PlacesSuggestionSchema>;
export type PlacesAutocompleteResponse = z.infer<typeof PlacesAutocompleteResponseSchema>;
export type PlaceDetailsQuery = z.infer<typeof PlaceDetailsQuerySchema>;
export type PlaceDetailsResponse = z.infer<typeof PlaceDetailsResponseSchema>;
export type Budget = z.infer<typeof BudgetSchema>;
export type GenerateItineraryOrigin = z.infer<typeof GenerateItineraryOriginSchema>;
export type CoreGroup = z.infer<typeof CoreGroupSchema>;
export type EatSubgroup = z.infer<typeof EatSubgroupSchema>;
export type DoSubgroup = z.infer<typeof DoSubgroupSchema>;
export type SipSubgroup = z.infer<typeof SipSubgroupSchema>;
export type Subgroup = z.infer<typeof SubgroupSchema>;
export type SequenceSlot = z.infer<typeof SequenceSlotSchema>;
export type AvoidItem = z.infer<typeof AvoidItemSchema>;
export type RadiusMode = z.infer<typeof RadiusModeSchema>;
export type GenerateItineraryRequest = z.infer<typeof GenerateItineraryRequestSchema>;
export type Candidate = z.infer<typeof CandidateSchema>;
export type BookingLikelihood = z.infer<typeof BookingLikelihoodSchema>;
export type BookingSignal = z.infer<typeof BookingSignalSchema>;
export type DebugPlaceCandidatesQuery = z.infer<typeof DebugPlaceCandidatesQuerySchema>;
export type DebugPlaceCandidatesResponse = z.infer<typeof DebugPlaceCandidatesResponseSchema>;
export type ItineraryStop = z.infer<typeof ItineraryStopSchema>;
export type ItineraryLeg = z.infer<typeof ItineraryLegSchema>;
export type ItineraryTotals = z.infer<typeof ItineraryTotalsSchema>;
export type GenerateItineraryResponse = z.infer<typeof GenerateItineraryResponseSchema>;
export type ItineraryConflictReason = z.infer<typeof ItineraryConflictReasonSchema>;
export type ConflictSuggestion = z.infer<typeof ConflictSuggestionSchema>;
export type GenerateItineraryConflictResponse = z.infer<typeof GenerateItineraryConflictResponseSchema>;
export type GenerateItineraryResult = z.infer<typeof GenerateItineraryResultSchema>;
