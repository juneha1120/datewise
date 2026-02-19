import { z } from 'zod';
export declare const VibeSchema: z.ZodEnum<["chill", "active", "romantic", "adventurous"]>;
export type Vibe = z.infer<typeof VibeSchema>;
export declare const PlanRequestSchema: z.ZodObject<{
    startArea: z.ZodString;
    startTimeIso: z.ZodString;
    endTimeIso: z.ZodString;
    budgetSgd: z.ZodNumber;
    vibe: z.ZodEnum<["chill", "active", "romantic", "adventurous"]>;
}, "strip", z.ZodTypeAny, {
    startArea: string;
    startTimeIso: string;
    endTimeIso: string;
    budgetSgd: number;
    vibe: "chill" | "active" | "romantic" | "adventurous";
}, {
    startArea: string;
    startTimeIso: string;
    endTimeIso: string;
    budgetSgd: number;
    vibe: "chill" | "active" | "romantic" | "adventurous";
}>;
export type PlanRequest = z.infer<typeof PlanRequestSchema>;
export declare const PlacesAutocompleteQuerySchema: z.ZodObject<{
    q: z.ZodString;
}, "strip", z.ZodTypeAny, {
    q: string;
}, {
    q: string;
}>;
export type PlacesAutocompleteQuery = z.infer<typeof PlacesAutocompleteQuerySchema>;
export declare const PlacesSuggestionSchema: z.ZodObject<{
    placeId: z.ZodString;
    primaryText: z.ZodString;
    secondaryText: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    placeId: string;
    primaryText: string;
    secondaryText: string;
}, {
    placeId: string;
    primaryText: string;
    secondaryText?: string | undefined;
}>;
export type PlacesSuggestion = z.infer<typeof PlacesSuggestionSchema>;
export declare const PlacesAutocompleteResponseSchema: z.ZodObject<{
    suggestions: z.ZodArray<z.ZodObject<{
        placeId: z.ZodString;
        primaryText: z.ZodString;
        secondaryText: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        placeId: string;
        primaryText: string;
        secondaryText: string;
    }, {
        placeId: string;
        primaryText: string;
        secondaryText?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    suggestions: {
        placeId: string;
        primaryText: string;
        secondaryText: string;
    }[];
}, {
    suggestions: {
        placeId: string;
        primaryText: string;
        secondaryText?: string | undefined;
    }[];
}>;
export type PlacesAutocompleteResponse = z.infer<typeof PlacesAutocompleteResponseSchema>;
export declare const PlaceDetailsQuerySchema: z.ZodObject<{
    placeId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    placeId: string;
}, {
    placeId: string;
}>;
export type PlaceDetailsQuery = z.infer<typeof PlaceDetailsQuerySchema>;
export declare const PlaceDetailsResponseSchema: z.ZodObject<{
    placeId: z.ZodString;
    name: z.ZodString;
    formattedAddress: z.ZodString;
    lat: z.ZodNumber;
    lng: z.ZodNumber;
    types: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    placeId: string;
    name: string;
    formattedAddress: string;
    lat: number;
    lng: number;
    types: string[];
}, {
    placeId: string;
    name: string;
    formattedAddress: string;
    lat: number;
    lng: number;
    types: string[];
}>;
export type PlaceDetailsResponse = z.infer<typeof PlaceDetailsResponseSchema>;
