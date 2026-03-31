'use client';

import type { ItinerarySlot, SlotType } from '@datewise/shared';

export type LatestPlannerResult = {
  input: {
    startPoint: { name: string; latitude: number; longitude: number; placeId: string };
    date: string;
    time: string;
    slots: SlotType[];
    avoidSlots: SlotType[];
  };
  result: ItinerarySlot[];
  savedAt: string;
};

const storageKey = 'datewise.latest-result';

export function writeLatestResult(value: LatestPlannerResult) {
  sessionStorage.setItem(storageKey, JSON.stringify(value));
}

export function readLatestResult(): LatestPlannerResult | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(storageKey);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as LatestPlannerResult;
  } catch {
    return null;
  }
}
