import { z } from 'zod';
export declare const VibeSchema: z.ZodEnum<["chill", "active", "romantic", "adventurous"]>;
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
export declare const PlacesAutocompleteQuerySchema: z.ZodObject<{
    q: z.ZodString;
}, "strip", z.ZodTypeAny, {
    q: string;
}, {
    q: string;
}>;
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
export declare const PlaceDetailsQuerySchema: z.ZodObject<{
    placeId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    placeId: string;
}, {
    placeId: string;
}>;
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
export declare const BudgetSchema: z.ZodEnum<["$", "$$", "$$$"]>;
export declare const DateStyleOptionSchema: z.ZodEnum<["FOOD", "ACTIVITY", "EVENT", "SCENIC", "SURPRISE"]>;
export declare const VibeOptionSchema: z.ZodEnum<["CHILL", "ACTIVE", "ROMANTIC", "ADVENTUROUS"]>;
export declare const FoodPreferenceSchema: z.ZodEnum<["VEG", "HALAL_FRIENDLY", "NO_ALCOHOL", "NO_SEAFOOD"]>;
export declare const AvoidPreferenceSchema: z.ZodEnum<["OUTDOOR", "PHYSICAL", "CROWDED", "LOUD"]>;
export declare const TransportSchema: z.ZodEnum<["MIN_WALK", "TRANSIT", "DRIVE_OK", "WALK_OK"]>;
export declare const GenerateItineraryOriginSchema: z.ZodObject<{
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
export declare const GenerateItineraryRequestSchema: z.ZodObject<{
    origin: z.ZodObject<{
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
    date: z.ZodString;
    startTime: z.ZodString;
    durationMin: z.ZodNumber;
    budget: z.ZodEnum<["$", "$$", "$$$"]>;
    dateStyle: z.ZodEnum<["FOOD", "ACTIVITY", "EVENT", "SCENIC", "SURPRISE"]>;
    vibe: z.ZodEnum<["CHILL", "ACTIVE", "ROMANTIC", "ADVENTUROUS"]>;
    food: z.ZodOptional<z.ZodArray<z.ZodEnum<["VEG", "HALAL_FRIENDLY", "NO_ALCOHOL", "NO_SEAFOOD"]>, "many">>;
    avoid: z.ZodOptional<z.ZodArray<z.ZodEnum<["OUTDOOR", "PHYSICAL", "CROWDED", "LOUD"]>, "many">>;
    transport: z.ZodOptional<z.ZodEnum<["MIN_WALK", "TRANSIT", "DRIVE_OK", "WALK_OK"]>>;
}, "strip", z.ZodTypeAny, {
    vibe: "CHILL" | "ACTIVE" | "ROMANTIC" | "ADVENTUROUS";
    date: string;
    origin: {
        placeId: string;
        name: string;
        formattedAddress: string;
        lat: number;
        lng: number;
        types: string[];
    };
    startTime: string;
    durationMin: number;
    budget: "$" | "$$" | "$$$";
    dateStyle: "FOOD" | "ACTIVITY" | "EVENT" | "SCENIC" | "SURPRISE";
    food?: ("VEG" | "HALAL_FRIENDLY" | "NO_ALCOHOL" | "NO_SEAFOOD")[] | undefined;
    avoid?: ("OUTDOOR" | "PHYSICAL" | "CROWDED" | "LOUD")[] | undefined;
    transport?: "MIN_WALK" | "TRANSIT" | "DRIVE_OK" | "WALK_OK" | undefined;
}, {
    vibe: "CHILL" | "ACTIVE" | "ROMANTIC" | "ADVENTUROUS";
    date: string;
    origin: {
        placeId: string;
        name: string;
        formattedAddress: string;
        lat: number;
        lng: number;
        types: string[];
    };
    startTime: string;
    durationMin: number;
    budget: "$" | "$$" | "$$$";
    dateStyle: "FOOD" | "ACTIVITY" | "EVENT" | "SCENIC" | "SURPRISE";
    food?: ("VEG" | "HALAL_FRIENDLY" | "NO_ALCOHOL" | "NO_SEAFOOD")[] | undefined;
    avoid?: ("OUTDOOR" | "PHYSICAL" | "CROWDED" | "LOUD")[] | undefined;
    transport?: "MIN_WALK" | "TRANSIT" | "DRIVE_OK" | "WALK_OK" | undefined;
}>;
export declare const ItineraryStopSchema: z.ZodObject<{
    kind: z.ZodEnum<["PLACE", "EVENT"]>;
    name: z.ZodString;
    lat: z.ZodNumber;
    lng: z.ZodNumber;
    address: z.ZodString;
    url: z.ZodString;
    rating: z.ZodNumber;
    reviewCount: z.ZodNumber;
    priceLevel: z.ZodNumber;
    tags: z.ZodArray<z.ZodString, "many">;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    lat: number;
    lng: number;
    kind: "EVENT" | "PLACE";
    address: string;
    url: string;
    rating: number;
    reviewCount: number;
    priceLevel: number;
    tags: string[];
    reason: string;
}, {
    name: string;
    lat: number;
    lng: number;
    kind: "EVENT" | "PLACE";
    address: string;
    url: string;
    rating: number;
    reviewCount: number;
    priceLevel: number;
    tags: string[];
    reason: string;
}>;
export declare const ItineraryLegSchema: z.ZodObject<{
    from: z.ZodNumber;
    to: z.ZodNumber;
    mode: z.ZodEnum<["WALK", "TRANSIT", "DRIVE"]>;
    durationMin: z.ZodNumber;
    distanceM: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    durationMin: number;
    from: number;
    to: number;
    mode: "TRANSIT" | "WALK" | "DRIVE";
    distanceM: number;
}, {
    durationMin: number;
    from: number;
    to: number;
    mode: "TRANSIT" | "WALK" | "DRIVE";
    distanceM: number;
}>;
export declare const ItineraryTotalsSchema: z.ZodObject<{
    durationMin: z.ZodNumber;
    walkingDistanceM: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    durationMin: number;
    walkingDistanceM: number;
}, {
    durationMin: number;
    walkingDistanceM: number;
}>;
export declare const GenerateItineraryResponseSchema: z.ZodObject<{
    itineraryId: z.ZodString;
    stops: z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<["PLACE", "EVENT"]>;
        name: z.ZodString;
        lat: z.ZodNumber;
        lng: z.ZodNumber;
        address: z.ZodString;
        url: z.ZodString;
        rating: z.ZodNumber;
        reviewCount: z.ZodNumber;
        priceLevel: z.ZodNumber;
        tags: z.ZodArray<z.ZodString, "many">;
        reason: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        lat: number;
        lng: number;
        kind: "EVENT" | "PLACE";
        address: string;
        url: string;
        rating: number;
        reviewCount: number;
        priceLevel: number;
        tags: string[];
        reason: string;
    }, {
        name: string;
        lat: number;
        lng: number;
        kind: "EVENT" | "PLACE";
        address: string;
        url: string;
        rating: number;
        reviewCount: number;
        priceLevel: number;
        tags: string[];
        reason: string;
    }>, "many">;
    legs: z.ZodArray<z.ZodObject<{
        from: z.ZodNumber;
        to: z.ZodNumber;
        mode: z.ZodEnum<["WALK", "TRANSIT", "DRIVE"]>;
        durationMin: z.ZodNumber;
        distanceM: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        durationMin: number;
        from: number;
        to: number;
        mode: "TRANSIT" | "WALK" | "DRIVE";
        distanceM: number;
    }, {
        durationMin: number;
        from: number;
        to: number;
        mode: "TRANSIT" | "WALK" | "DRIVE";
        distanceM: number;
    }>, "many">;
    totals: z.ZodObject<{
        durationMin: z.ZodNumber;
        walkingDistanceM: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        durationMin: number;
        walkingDistanceM: number;
    }, {
        durationMin: number;
        walkingDistanceM: number;
    }>;
    meta: z.ZodObject<{
        usedCache: z.ZodBoolean;
        warnings: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        usedCache: boolean;
        warnings: string[];
    }, {
        usedCache: boolean;
        warnings: string[];
    }>;
}, "strip", z.ZodTypeAny, {
    itineraryId: string;
    stops: {
        name: string;
        lat: number;
        lng: number;
        kind: "EVENT" | "PLACE";
        address: string;
        url: string;
        rating: number;
        reviewCount: number;
        priceLevel: number;
        tags: string[];
        reason: string;
    }[];
    legs: {
        durationMin: number;
        from: number;
        to: number;
        mode: "TRANSIT" | "WALK" | "DRIVE";
        distanceM: number;
    }[];
    totals: {
        durationMin: number;
        walkingDistanceM: number;
    };
    meta: {
        usedCache: boolean;
        warnings: string[];
    };
}, {
    itineraryId: string;
    stops: {
        name: string;
        lat: number;
        lng: number;
        kind: "EVENT" | "PLACE";
        address: string;
        url: string;
        rating: number;
        reviewCount: number;
        priceLevel: number;
        tags: string[];
        reason: string;
    }[];
    legs: {
        durationMin: number;
        from: number;
        to: number;
        mode: "TRANSIT" | "WALK" | "DRIVE";
        distanceM: number;
    }[];
    totals: {
        durationMin: number;
        walkingDistanceM: number;
    };
    meta: {
        usedCache: boolean;
        warnings: string[];
    };
}>;
export type Vibe = z.infer<typeof VibeSchema>;
export type PlanRequest = z.infer<typeof PlanRequestSchema>;
export type PlacesAutocompleteQuery = z.infer<typeof PlacesAutocompleteQuerySchema>;
export type PlacesSuggestion = z.infer<typeof PlacesSuggestionSchema>;
export type PlacesAutocompleteResponse = z.infer<typeof PlacesAutocompleteResponseSchema>;
export type PlaceDetailsQuery = z.infer<typeof PlaceDetailsQuerySchema>;
export type PlaceDetailsResponse = z.infer<typeof PlaceDetailsResponseSchema>;
export type Budget = z.infer<typeof BudgetSchema>;
export type DateStyleOption = z.infer<typeof DateStyleOptionSchema>;
export type VibeOption = z.infer<typeof VibeOptionSchema>;
export type FoodPreference = z.infer<typeof FoodPreferenceSchema>;
export type AvoidPreference = z.infer<typeof AvoidPreferenceSchema>;
export type Transport = z.infer<typeof TransportSchema>;
export type GenerateItineraryOrigin = z.infer<typeof GenerateItineraryOriginSchema>;
export type GenerateItineraryRequest = z.infer<typeof GenerateItineraryRequestSchema>;
export type ItineraryStop = z.infer<typeof ItineraryStopSchema>;
export type ItineraryLeg = z.infer<typeof ItineraryLegSchema>;
export type ItineraryTotals = z.infer<typeof ItineraryTotalsSchema>;
export type GenerateItineraryResponse = z.infer<typeof GenerateItineraryResponseSchema>;
