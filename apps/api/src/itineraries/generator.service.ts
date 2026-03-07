import { BadRequestException, Injectable } from '@nestjs/common';
import { DURATION_BY_CORE, GenerateItineraryInput, detectConflict, expandSelection, generateItinerarySchema, resolveCore } from '@datewise/shared';
import { randomUUID } from 'node:crypto';
import { db } from '../db';
import { PlacesProvider } from '../places/provider';

@Injectable()
export class GeneratorService {
  constructor(private readonly places: PlacesProvider) {}

  async generate(input: GenerateItineraryInput) {
    const parsed = generateItinerarySchema.parse(input);
    const conflicts = detectConflict(parsed.includeSlots, parsed.avoidSlots);
    if (conflicts.length > 0) throw new BadRequestException({ message: 'Slot conflict', conflicts });

    const avoided = new Set(parsed.avoidSlots.flatMap((item) => expandSelection(item)));
    let cursor: { lat: number; lng: number } = { lat: parsed.start.lat, lng: parsed.start.lng };
    let currentMinutes = 0;

    const slots = [] as Array<{ slotIndex: number; selection: string; placeName: string; subgroup: string; travelMinutes: number; startOffsetMin: number; durationMin: number }>;
    const used = new Set<string>();

    for (const [idx, selection] of parsed.includeSlots.entries()) {
      const subgroup = expandSelection(selection).find((entry) => !avoided.has(entry));
      if (!subgroup) throw new BadRequestException(`No allowed subgroup for slot ${idx + 1}`);
      const candidates = await this.places.search(subgroup, cursor);
      const picked = candidates.find((candidate) => !used.has(candidate.placeId) && candidate.isOpen);
      if (!picked) throw new BadRequestException(`No place found for slot ${idx + 1}`);
      const travelMinutes = idx === 0 ? 0 : this.places.travelMinutes(cursor, picked);
      currentMinutes += travelMinutes;
      const durationMin = DURATION_BY_CORE[resolveCore(selection)];
      slots.push({ slotIndex: idx, selection, placeName: picked.name, subgroup: picked.subgroup, travelMinutes, startOffsetMin: currentMinutes, durationMin });
      currentMinutes += durationMin;
      cursor = { lat: picked.lat, lng: picked.lng };
      used.add(picked.placeId);
    }

    return slots;
  }

  async saveGenerated(userId: string, input: GenerateItineraryInput, isPublic: boolean) {
    const slots = await this.generate(input);
    const itinerary = { id: randomUUID(), userId, title: `Datewise plan ${new Date().toISOString().slice(0, 10)}`, isPublic, inputJson: JSON.stringify(input), edited: false, sourceId: null, slots, createdAt: new Date().toISOString() };
    db.itineraries.set(itinerary.id, itinerary);
    return itinerary;
  }
}
