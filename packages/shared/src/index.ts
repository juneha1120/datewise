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

export type Vibe = z.infer<typeof VibeSchema>;
export type PlanRequest = z.infer<typeof PlanRequestSchema>;
export type PlacesAutocompleteQuery = z.infer<typeof PlacesAutocompleteQuerySchema>;
export type PlacesSuggestion = z.infer<typeof PlacesSuggestionSchema>;
export type PlacesAutocompleteResponse = z.infer<typeof PlacesAutocompleteResponseSchema>;
export type PlaceDetailsQuery = z.infer<typeof PlaceDetailsQuerySchema>;
export type PlaceDetailsResponse = z.infer<typeof PlaceDetailsResponseSchema>;
