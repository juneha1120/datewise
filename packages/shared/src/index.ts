import { z } from 'zod';

export const CORE_GROUPS = ['EAT', 'DO', 'SIP'] as const;
export type CoreGroup = (typeof CORE_GROUPS)[number];

export const SUBGROUPS = {
  EAT: ['JAPANESE', 'KOREAN', 'CHINESE', 'THAI', 'WESTERN', 'ITALIAN', 'INDIAN', 'MALAY', 'INDONESIAN', 'VIETNAMESE', 'MIDDLE_EASTERN', 'SEAFOOD', 'LOCAL', 'HAWKER'],
  DO: ['MUSEUM', 'GALLERY', 'EXHIBITION', 'SHOPPING', 'WELLNESS', 'CINEMA', 'CLASSES', 'WALK_IN_PARK', 'SCENIC_WALK', 'ARCADE', 'BOWLING', 'KARAOKE', 'ESCAPE_ROOM', 'INDOOR_SPORTS', 'OUTDOOR_ACTIVITY', 'ATTRACTION'],
  SIP: ['COFFEE', 'DESSERT', 'BUBBLE_TEA', 'TEA_HOUSE', 'COCKTAIL', 'WINE', 'BEER', 'SPIRIT'],
} as const;

export type Subgroup = (typeof SUBGROUPS)[keyof typeof SUBGROUPS][number];
export type SlotSelection = CoreGroup | Subgroup;

const subgroupToCore = Object.entries(SUBGROUPS).reduce<Record<string, CoreGroup>>((acc, [core, values]) => {
  values.forEach((value) => {
    acc[value] = core as CoreGroup;
  });
  return acc;
}, {});

export const DURATION_BY_CORE: Record<CoreGroup, number> = {
  EAT: 90,
  DO: 120,
  SIP: 90,
};

export function isCoreGroup(input: string): input is CoreGroup {
  return CORE_GROUPS.includes(input as CoreGroup);
}

export function isSubgroup(input: string): input is Subgroup {
  return input in subgroupToCore;
}

export function resolveCore(selection: SlotSelection): CoreGroup {
  return isCoreGroup(selection) ? selection : subgroupToCore[selection];
}

export function expandSelection(selection: SlotSelection): Subgroup[] {
  if (isSubgroup(selection)) return [selection];
  return [...SUBGROUPS[selection]];
}

export function detectConflict(includeSlots: SlotSelection[], avoidSlots: SlotSelection[]): string[] {
  const avoidExpanded = new Set(avoidSlots.flatMap((slot) => expandSelection(slot)));
  return includeSlots
    .map((slot, idx) => ({ idx, expanded: expandSelection(slot) }))
    .filter(({ expanded }) => expanded.some((entry) => avoidExpanded.has(entry)))
    .map(({ idx }) => `includeSlots[${idx}] conflicts with avoid slots`);
}

export const generateItinerarySchema = z.object({
  start: z.object({
    label: z.string().min(1),
    lat: z.number(),
    lng: z.number(),
  }),
  date: z.string().min(1),
  time: z.string().min(1),
  includeSlots: z.array(z.string()).min(2).max(4).refine((values) => values.every((value) => isCoreGroup(value) || isSubgroup(value)), 'Invalid slot selection'),
  avoidSlots: z.array(z.string()).default([]).refine((values) => values.every((value) => isCoreGroup(value) || isSubgroup(value)), 'Invalid avoid selection'),
});

export type GenerateItineraryInput = z.infer<typeof generateItinerarySchema>;
