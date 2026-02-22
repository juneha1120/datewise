"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerateItineraryResponseSchema = exports.ItineraryTotalsSchema = exports.ItineraryLegSchema = exports.ItineraryStopSchema = exports.GenerateItineraryRequestSchema = exports.GenerateItineraryOriginSchema = exports.TransportSchema = exports.AvoidPreferenceSchema = exports.FoodPreferenceSchema = exports.VibeOptionSchema = exports.DateStyleOptionSchema = exports.BudgetSchema = exports.PlaceDetailsResponseSchema = exports.PlaceDetailsQuerySchema = exports.PlacesAutocompleteResponseSchema = exports.PlacesSuggestionSchema = exports.PlacesAutocompleteQuerySchema = exports.PlanRequestSchema = exports.VibeSchema = void 0;
const zod_1 = require("zod");
exports.VibeSchema = zod_1.z.enum(['chill', 'active', 'romantic', 'adventurous']);
exports.PlanRequestSchema = zod_1.z.object({
    startArea: zod_1.z.string().min(1),
    startTimeIso: zod_1.z.string().datetime(),
    endTimeIso: zod_1.z.string().datetime(),
    budgetSgd: zod_1.z.number().int().positive(),
    vibe: exports.VibeSchema,
});
exports.PlacesAutocompleteQuerySchema = zod_1.z.object({
    q: zod_1.z.string().min(2).max(120),
});
exports.PlacesSuggestionSchema = zod_1.z.object({
    placeId: zod_1.z.string().min(1),
    primaryText: zod_1.z.string().min(1),
    secondaryText: zod_1.z.string().default(''),
});
exports.PlacesAutocompleteResponseSchema = zod_1.z.object({
    suggestions: zod_1.z.array(exports.PlacesSuggestionSchema),
});
exports.PlaceDetailsQuerySchema = zod_1.z.object({
    placeId: zod_1.z.string().min(1),
});
exports.PlaceDetailsResponseSchema = zod_1.z.object({
    placeId: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1),
    formattedAddress: zod_1.z.string().min(1),
    lat: zod_1.z.number(),
    lng: zod_1.z.number(),
    types: zod_1.z.array(zod_1.z.string()),
});
const DateSchema = zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, 'Invalid date format. Use YYYY-MM-DD.');
const TimeSchema = zod_1.z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/u, 'Invalid time format. Use HH:mm.');
exports.BudgetSchema = zod_1.z.enum(['$', '$$', '$$$']);
exports.DateStyleOptionSchema = zod_1.z.enum(['FOOD', 'ACTIVITY', 'EVENT', 'SCENIC', 'SURPRISE']);
exports.VibeOptionSchema = zod_1.z.enum(['CHILL', 'ACTIVE', 'ROMANTIC', 'ADVENTUROUS']);
exports.FoodPreferenceSchema = zod_1.z.enum(['VEG', 'HALAL_FRIENDLY', 'NO_ALCOHOL', 'NO_SEAFOOD']);
exports.AvoidPreferenceSchema = zod_1.z.enum(['OUTDOOR', 'PHYSICAL', 'CROWDED', 'LOUD']);
exports.TransportSchema = zod_1.z.enum(['MIN_WALK', 'TRANSIT', 'DRIVE_OK', 'WALK_OK']);
exports.GenerateItineraryOriginSchema = exports.PlaceDetailsResponseSchema;
exports.GenerateItineraryRequestSchema = zod_1.z.object({
    origin: exports.GenerateItineraryOriginSchema,
    date: DateSchema,
    startTime: TimeSchema,
    durationMin: zod_1.z.number().int().min(30).max(1440),
    budget: exports.BudgetSchema,
    dateStyle: exports.DateStyleOptionSchema,
    vibe: exports.VibeOptionSchema,
    food: zod_1.z.array(exports.FoodPreferenceSchema).optional(),
    avoid: zod_1.z.array(exports.AvoidPreferenceSchema).optional(),
    transport: exports.TransportSchema.optional(),
});
exports.ItineraryStopSchema = zod_1.z.object({
    kind: zod_1.z.enum(['PLACE', 'EVENT']),
    name: zod_1.z.string().min(1),
    lat: zod_1.z.number(),
    lng: zod_1.z.number(),
    address: zod_1.z.string().min(1),
    url: zod_1.z.string().min(1),
    rating: zod_1.z.number().min(0).max(5),
    reviewCount: zod_1.z.number().int().min(0),
    priceLevel: zod_1.z.number().int().min(0).max(4),
    tags: zod_1.z.array(zod_1.z.string().min(1)),
    reason: zod_1.z.string().min(1),
});
exports.ItineraryLegSchema = zod_1.z.object({
    from: zod_1.z.number().int().min(0),
    to: zod_1.z.number().int().min(0),
    mode: zod_1.z.enum(['WALK', 'TRANSIT', 'DRIVE']),
    durationMin: zod_1.z.number().int().min(1),
    distanceM: zod_1.z.number().int().min(1),
});
exports.ItineraryTotalsSchema = zod_1.z.object({
    durationMin: zod_1.z.number().int().min(1),
    walkingDistanceM: zod_1.z.number().int().min(0),
});
exports.GenerateItineraryResponseSchema = zod_1.z.object({
    itineraryId: zod_1.z.string().min(1),
    stops: zod_1.z.array(exports.ItineraryStopSchema),
    legs: zod_1.z.array(exports.ItineraryLegSchema),
    totals: exports.ItineraryTotalsSchema,
    meta: zod_1.z.object({
        usedCache: zod_1.z.boolean(),
        warnings: zod_1.z.array(zod_1.z.string()),
    }),
});
