import { z } from 'zod';

export const VibeSchema = z.enum(['chill', 'active', 'romantic', 'adventurous']);

export const PlanRequestSchema = z.object({
  startArea: z.string().min(1),
  startTimeIso: z.string().datetime(),
  endTimeIso: z.string().datetime(),
  budgetSgd: z.number().int().positive(),
  vibe: VibeSchema,
});

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

export const GenerateItineraryOriginSchema = PlaceDetailsResponseSchema;

export const GenerateItineraryRequestSchema = z.object({
  origin: GenerateItineraryOriginSchema,
  date: DateSchema,
  startTime: TimeSchema,
  durationMin: z.number().int().min(30).max(1440),
  budget: z.string().min(1),
  dateStyle: z.string().min(1),
  vibe: z.string().min(1),
  food: z.array(z.string().min(1)).optional(),
  avoid: z.array(z.string().min(1)).optional(),
  transport: z.string().min(1).optional(),
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
  reason: z.string().min(1),
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
  itineraryId: z.string().min(1),
  stops: z.array(ItineraryStopSchema),
  legs: z.array(ItineraryLegSchema),
  totals: ItineraryTotalsSchema,
  meta: z.object({
    usedCache: z.boolean(),
    warnings: z.array(z.string()),
  }),
});

export type Vibe = z.infer<typeof VibeSchema>;
export type PlanRequest = z.infer<typeof PlanRequestSchema>;
export type PlacesAutocompleteQuery = z.infer<typeof PlacesAutocompleteQuerySchema>;
export type PlacesSuggestion = z.infer<typeof PlacesSuggestionSchema>;
export type PlacesAutocompleteResponse = z.infer<typeof PlacesAutocompleteResponseSchema>;
export type PlaceDetailsQuery = z.infer<typeof PlaceDetailsQuerySchema>;
export type PlaceDetailsResponse = z.infer<typeof PlaceDetailsResponseSchema>;
export type GenerateItineraryOrigin = z.infer<typeof GenerateItineraryOriginSchema>;
export type GenerateItineraryRequest = z.infer<typeof GenerateItineraryRequestSchema>;
export type ItineraryStop = z.infer<typeof ItineraryStopSchema>;
export type ItineraryLeg = z.infer<typeof ItineraryLegSchema>;
export type ItineraryTotals = z.infer<typeof ItineraryTotalsSchema>;
export type GenerateItineraryResponse = z.infer<typeof GenerateItineraryResponseSchema>;
