import { AvoidItem, CoreGroup, RadiusMode, SequenceSlot, Subgroup } from '@datewise/shared';

export const CORE_SUBGROUPS: Readonly<Record<CoreGroup, readonly Subgroup[]>> = {
  EAT: ['JAPANESE', 'KOREAN', 'CHINESE', 'THAI', 'WESTERN', 'ITALIAN', 'INDIAN', 'MALAY', 'INDONESIAN', 'VIETNAMESE', 'MIDDLE_EASTERN', 'SEAFOOD', 'LOCAL', 'HAWKER'],
  DO: ['MUSEUM', 'GALLERY', 'EXHIBITION', 'SHOPPING', 'WELLNESS', 'CINEMA', 'CLASSES', 'WALK_IN_PARK', 'SCENIC_WALK', 'ARCADE', 'BOWLING', 'KARAOKE', 'ESCAPE_ROOM', 'INDOOR_SPORTS', 'OUTDOOR_ACTIVITY', 'ATTRACTION'],
  SIP: ['COFFEE', 'DESSERT', 'BUBBLE_TEA', 'TEA_HOUSE', 'COCKTAIL', 'WINE', 'BEER', 'SPIRIT'],
};

export const SUBGROUP_CORE: Readonly<Record<Subgroup, CoreGroup>> = Object.entries(CORE_SUBGROUPS).reduce(
  (acc, [core, subgroups]) => {
    for (const subgroup of subgroups) {
      acc[subgroup] = core as CoreGroup;
    }
    return acc;
  },
  {} as Record<Subgroup, CoreGroup>,
);

export const SIMILAR_MAP: Readonly<Record<Subgroup, readonly Subgroup[]>> = {
  COFFEE: ['DESSERT', 'TEA_HOUSE', 'BUBBLE_TEA'], DESSERT: ['COFFEE', 'BUBBLE_TEA', 'TEA_HOUSE'], BUBBLE_TEA: ['TEA_HOUSE', 'COFFEE', 'DESSERT'], TEA_HOUSE: ['BUBBLE_TEA', 'COFFEE', 'DESSERT'], COCKTAIL: ['WINE', 'SPIRIT', 'BEER'], WINE: ['COCKTAIL', 'SPIRIT', 'BEER'], BEER: ['COCKTAIL', 'SPIRIT', 'WINE'], SPIRIT: ['COCKTAIL', 'WINE', 'BEER'],
  MUSEUM: ['GALLERY', 'EXHIBITION', 'ATTRACTION'], GALLERY: ['EXHIBITION', 'MUSEUM', 'ATTRACTION'], EXHIBITION: ['GALLERY', 'MUSEUM', 'ATTRACTION'], SHOPPING: ['ATTRACTION', 'SCENIC_WALK', 'WALK_IN_PARK'], WELLNESS: ['CLASSES', 'WALK_IN_PARK', 'SCENIC_WALK'], CINEMA: ['ATTRACTION', 'EXHIBITION', 'ARCADE'], CLASSES: ['WELLNESS', 'EXHIBITION', 'GALLERY'], WALK_IN_PARK: ['SCENIC_WALK', 'OUTDOOR_ACTIVITY', 'ATTRACTION'], SCENIC_WALK: ['WALK_IN_PARK', 'ATTRACTION', 'OUTDOOR_ACTIVITY'], ARCADE: ['BOWLING', 'KARAOKE', 'ESCAPE_ROOM'], BOWLING: ['ARCADE', 'KARAOKE', 'INDOOR_SPORTS'], KARAOKE: ['ARCADE', 'BOWLING', 'ESCAPE_ROOM'], ESCAPE_ROOM: ['ARCADE', 'KARAOKE', 'CLASSES'], INDOOR_SPORTS: ['OUTDOOR_ACTIVITY', 'BOWLING', 'ARCADE'], OUTDOOR_ACTIVITY: ['WALK_IN_PARK', 'SCENIC_WALK', 'ATTRACTION'], ATTRACTION: ['SCENIC_WALK', 'MUSEUM', 'SHOPPING'],
  JAPANESE: ['KOREAN', 'CHINESE', 'SEAFOOD', 'WESTERN'], KOREAN: ['JAPANESE', 'CHINESE', 'THAI', 'WESTERN'], CHINESE: ['LOCAL', 'HAWKER', 'JAPANESE', 'THAI'], THAI: ['VIETNAMESE', 'INDONESIAN', 'KOREAN', 'INDIAN'], WESTERN: ['ITALIAN', 'SEAFOOD', 'JAPANESE', 'MIDDLE_EASTERN'], ITALIAN: ['WESTERN', 'SEAFOOD', 'MIDDLE_EASTERN', 'LOCAL'], INDIAN: ['MIDDLE_EASTERN', 'THAI', 'MALAY', 'INDONESIAN'], MALAY: ['INDONESIAN', 'LOCAL', 'HAWKER', 'INDIAN'], INDONESIAN: ['MALAY', 'THAI', 'VIETNAMESE', 'LOCAL'], VIETNAMESE: ['THAI', 'CHINESE', 'INDONESIAN', 'LOCAL'], MIDDLE_EASTERN: ['INDIAN', 'WESTERN', 'ITALIAN', 'SEAFOOD'], SEAFOOD: ['JAPANESE', 'CHINESE', 'WESTERN', 'LOCAL'], LOCAL: ['HAWKER', 'CHINESE', 'MALAY', 'INDIAN'], HAWKER: ['LOCAL', 'CHINESE', 'MALAY', 'INDIAN'],
};

export function radiusConfig(mode: RadiusMode): { maxLegKm: number; legMode: 'WALK' | 'TRANSIT' | 'DRIVE' } {
  if (mode === 'WALKABLE') return { maxLegKm: 1, legMode: 'WALK' };
  if (mode === 'SHORT_TRANSIT') return { maxLegKm: 5, legMode: 'TRANSIT' };
  return { maxLegKm: 15, legMode: 'DRIVE' };
}

export function subgroupDurationMin(subgroup: Subgroup): number {
  if (subgroup === 'CINEMA') return 120;
  if (subgroup === 'CLASSES' || subgroup === 'WELLNESS') return 90;
  if (subgroup === 'DESSERT') return 40;
  if (subgroup === 'COCKTAIL' || subgroup === 'WINE' || subgroup === 'SPIRIT') return 60;
  if (SUBGROUP_CORE[subgroup] === 'EAT') return 75;
  if (SUBGROUP_CORE[subgroup] === 'SIP') return 45;
  return 75;
}

export function avoidToSubgroups(avoid: readonly AvoidItem[]): Set<Subgroup> {
  const blocked = new Set<Subgroup>();
  for (const item of avoid) {
    if (item.type === 'SUBGROUP') blocked.add(item.subgroup);
    if (item.type === 'CORE') {
      for (const subgroup of CORE_SUBGROUPS[item.core]) blocked.add(subgroup);
    }
  }
  return blocked;
}

export function resolveSlotSubgroups(slot: SequenceSlot, avoid: Set<Subgroup>): Subgroup[] {
  if (slot.type === 'SUBGROUP') return avoid.has(slot.subgroup) ? [] : [slot.subgroup];
  return CORE_SUBGROUPS[slot.core].filter((subgroup) => !avoid.has(subgroup));
}

export function openScoreFromState(state: 'OPEN' | 'UNKNOWN' | 'CLOSED'): number {
  if (state === 'OPEN') return 1;
  if (state === 'UNKNOWN') return 0.7;
  return 0;
}

export function similarSuggestions(subgroup: Subgroup, avoid: Set<Subgroup>): Subgroup[] {
  return (SIMILAR_MAP[subgroup] ?? []).filter((candidate) => !avoid.has(candidate));
}
