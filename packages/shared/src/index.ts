import { z } from 'zod';

export const CORE_GROUPS = ['EAT', 'DO', 'SIP'] as const;
export type CoreGroup = (typeof CORE_GROUPS)[number];

export const SUBGROUPS = {
  EAT: ['JAPANESE', 'KOREAN', 'CHINESE', 'THAI', 'WESTERN', 'ITALIAN', 'INDIAN', 'MALAY', 'INDONESIAN', 'VIETNAMESE', 'MIDDLE_EASTERN', 'SEAFOOD', 'LOCAL', 'HAWKER'],
  DO: ['MUSEUM', 'GALLERY', 'EXHIBITION', 'SHOPPING', 'WELLNESS', 'CINEMA', 'CLASSES', 'WALK_IN_PARK', 'SCENIC_WALK', 'ARCADE', 'BOWLING', 'KARAOKE', 'ESCAPE_ROOM', 'INDOOR_SPORTS', 'OUTDOOR_ACTIVITY', 'ATTRACTION'],
  SIP: ['COFFEE', 'DESSERT', 'BUBBLE_TEA', 'TEA_HOUSE', 'COCKTAIL', 'WINE', 'BEER', 'SPIRIT'],
} as const;

export type Subgroup = (typeof SUBGROUPS)[keyof typeof SUBGROUPS][number];
export type SlotType = CoreGroup | Subgroup;

const subgroupToCore = Object.entries(SUBGROUPS).reduce<Record<string, CoreGroup>>((acc, [core, values]) => {
  values.forEach((value) => {
    acc[value] = core as CoreGroup;
  });
  return acc;
}, {});

export const DURATION_BY_CORE: Record<CoreGroup, number> = { EAT: 90, DO: 120, SIP: 90 };

export function isCoreGroup(input: string): input is CoreGroup {
  return CORE_GROUPS.includes(input as CoreGroup);
}

export function isSubgroup(input: string): input is Subgroup {
  return input in subgroupToCore;
}

export function resolveCore(selection: SlotType): CoreGroup {
  return isCoreGroup(selection) ? selection : subgroupToCore[selection];
}

export function expandSelection(selection: SlotType): Subgroup[] {
  return isSubgroup(selection) ? [selection] : [...SUBGROUPS[selection]];
}

export function detectConflict(slots: SlotType[], avoidSlots: SlotType[]): string[] {
  const avoidExpanded = new Set(avoidSlots.flatMap((slot) => expandSelection(slot)));
  return slots
    .map((slot, idx) => ({ idx, expanded: expandSelection(slot) }))
    .filter(({ expanded }) => expanded.some((entry) => avoidExpanded.has(entry)))
    .map(({ idx }) => `slots[${idx}] conflicts with avoidSlots`);
}

const slotTypeSchema = z.string().refine((value) => isCoreGroup(value) || isSubgroup(value), 'Invalid slot type') as z.ZodType<SlotType>;

export const startPointSchema = z.object({
  name: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
  placeId: z.string().min(1),
});

export const placeSchema = z.object({
  name: z.string(),
  placeId: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  address: z.string(),
  rating: z.number().optional(),
});

export const itinerarySlotSchema = z.object({
  slotIndex: z.number().int().min(0),
  slotType: slotTypeSchema,
  place: placeSchema,
  arrivalTime: z.string(),
  departureTime: z.string(),
  subgroup: z.string(),
  travelMinutes: z.number().int().min(0),
});

const generateItineraryInputBaseSchema = z.object({
  startPoint: startPointSchema,
  date: z.string().min(1),
  time: z.string().min(1),
  slots: z.array(slotTypeSchema).min(2).max(4),
  avoidSlots: z.array(slotTypeSchema).default([]),
});

export const generateItineraryInputSchema = generateItineraryInputBaseSchema.superRefine((input, ctx) => {
  const conflicts = detectConflict(input.slots, input.avoidSlots);
  conflicts.forEach((message) => ctx.addIssue({ code: z.ZodIssueCode.custom, message }));
});

export const regenerateSlotInputSchema = generateItineraryInputBaseSchema
  .extend({
    slotIndex: z.number().int().min(0),
    existingPlaceIds: z.array(z.string()).default([]),
  })
  .superRefine((input, ctx) => {
    const conflicts = detectConflict(input.slots, input.avoidSlots);
    conflicts.forEach((message) => ctx.addIssue({ code: z.ZodIssueCode.custom, message }));
  });

export const itineraryRecordSchema = z.object({
  id: z.string(),
  userId: z.string(),
  input: generateItineraryInputSchema,
  result: z.array(itinerarySlotSchema),
  isPublic: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  editedAfterGeneration: z.boolean(),
  sourceItineraryId: z.string().nullable(),
});

export type GenerateItineraryInput = z.infer<typeof generateItineraryInputSchema>;
export type RegenerateSlotInput = z.infer<typeof regenerateSlotInputSchema>;
export type ItinerarySlot = z.infer<typeof itinerarySlotSchema>;
export type ItineraryRecord = z.infer<typeof itineraryRecordSchema>;

// Legacy aliases for older app code.
export type SlotSelection = SlotType;
export const generateItinerarySchema = generateItineraryInputSchema;
export const regenerateSlotSchema = regenerateSlotInputSchema;
