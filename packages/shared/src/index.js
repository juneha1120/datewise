"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaceDetailsResponseSchema = exports.PlaceDetailsQuerySchema = exports.PlacesAutocompleteResponseSchema = exports.PlacesSuggestionSchema = exports.PlacesAutocompleteQuerySchema = exports.PlanRequestSchema = exports.VibeSchema = void 0;
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
//# sourceMappingURL=index.js.map