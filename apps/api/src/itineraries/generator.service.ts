import { BadRequestException, Injectable } from '@nestjs/common';
import { DURATION_BY_CORE, GenerateItineraryInput, RegenerateSlotInput, detectConflict, expandSelection, generateItinerarySchema, regenerateSlotSchema, resolveCore } from '@datewise/shared';
import { randomUUID } from 'node:crypto';
import { db, type ItinerarySlot } from '../db';
import { PlacesProvider } from '../places/provider';
import { ScoringService } from './scoring.service';
import { TaggingService } from './tagging.service';

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function combineDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00`);
}

@Injectable()
export class GeneratorService {
  private readonly tagging = new TaggingService();

  constructor(private readonly places: PlacesProvider, private readonly scoring: ScoringService) {}

  private async pickBest(selection: GenerateItineraryInput['includeSlots'][number], cursor: { lat: number; lng: number }, avoided: Set<string>, blockedNames: Set<string>) {
    const subgroup = expandSelection(selection).find((entry) => !avoided.has(entry));
    if (!subgroup) throw new BadRequestException('No allowed subgroup candidates');
    const candidates = await this.places.search(subgroup, cursor);
    const scored = candidates
      .filter((candidate) => candidate.isOpen && !blockedNames.has(candidate.name))
      .map((candidate) => {
        const travelMinutes = this.places.travelMinutes(cursor, candidate);
        const relevance = this.tagging.relevanceScore(subgroup, candidate.name);
        return {
          candidate,
          travelMinutes,
          score: this.scoring.score({ relevance, travelMinutes, rating: candidate.rating }),
        };
      })
      .sort((a, b) => b.score - a.score);
    if (!scored[0]) throw new BadRequestException('No candidate found for slot');
    return { subgroup, ...scored[0] };
  }

  async generate(input: GenerateItineraryInput): Promise<ItinerarySlot[]> {
    const parsed = generateItinerarySchema.parse(input);
    const conflicts = detectConflict(parsed.includeSlots, parsed.avoidSlots);
    if (conflicts.length > 0) throw new BadRequestException({ message: 'Slot conflict', conflicts });

    const baseDateTime = combineDateTime(parsed.date, parsed.time);
    const avoided = new Set(parsed.avoidSlots.flatMap((item) => expandSelection(item)));
    let cursor: { lat: number; lng: number } = { lat: parsed.start.lat, lng: parsed.start.lng };
    let currentMinutes = 0;
    const used = new Set<string>();
    const slots: ItinerarySlot[] = [];

    for (const [idx, selection] of parsed.includeSlots.entries()) {
      const picked = await this.pickBest(selection, cursor, avoided, used);
      const travelMinutes = idx === 0 ? 0 : picked.travelMinutes;
      currentMinutes += travelMinutes;
      const arrival = addMinutes(baseDateTime, currentMinutes);
      const durationMin = DURATION_BY_CORE[resolveCore(selection)];
      const departure = addMinutes(arrival, durationMin);
      slots.push({
        slotIndex: idx,
        selection,
        slotType: resolveCore(selection),
        placeName: picked.candidate.name,
        place: {
          name: picked.candidate.name,
          placeId: picked.candidate.placeId,
          latitude: picked.candidate.lat,
          longitude: picked.candidate.lng,
          address: `Singapore (${picked.candidate.subgroup.replaceAll('_', ' ')})`,
          rating: picked.candidate.rating,
        },
        subgroup: picked.subgroup,
        travelMinutes,
        startOffsetMin: currentMinutes,
        durationMin,
        arrivalTime: arrival.toISOString(),
        departureTime: departure.toISOString(),
        lat: picked.candidate.lat,
        lng: picked.candidate.lng,
      });
      currentMinutes += durationMin;
      cursor = { lat: picked.candidate.lat, lng: picked.candidate.lng };
      used.add(picked.candidate.name);
    }

    return slots;
  }

  async regenerateSlot(input: RegenerateSlotInput): Promise<ItinerarySlot> {
    const parsed = regenerateSlotSchema.parse(input);
    const base = await this.generate(parsed);
    const original = base[parsed.slotIndex];
    if (!original) throw new BadRequestException('Invalid slot index');
    const blocked = new Set(parsed.existingPlaceNames);
    blocked.add(original.placeName);
    const cursor = parsed.slotIndex === 0 ? parsed.start : base[parsed.slotIndex - 1];
    const avoided = new Set(parsed.avoidSlots.flatMap((item) => expandSelection(item)));
    const picked = await this.pickBest(parsed.includeSlots[parsed.slotIndex], { lat: cursor.lat, lng: cursor.lng }, avoided, blocked);
    return {
      ...original,
      placeName: picked.candidate.name,
      place: {
        name: picked.candidate.name,
        placeId: picked.candidate.placeId,
        latitude: picked.candidate.lat,
        longitude: picked.candidate.lng,
        address: `Singapore (${picked.candidate.subgroup.replaceAll('_', ' ')})`,
        rating: picked.candidate.rating,
      },
      subgroup: picked.subgroup,
      travelMinutes: parsed.slotIndex === 0 ? 0 : picked.travelMinutes,
      lat: picked.candidate.lat,
      lng: picked.candidate.lng,
    };
  }

  async saveGenerated(userId: string, input: GenerateItineraryInput, isPublic: boolean) {
    const slots = await this.generate(input);
    const itinerary = {
      id: randomUUID(),
      userId,
      title: `Datewise plan ${new Date().toISOString().slice(0, 10)}`,
      isPublic,
      inputJson: JSON.stringify(input),
      edited: false,
      sourceId: null,
      slots,
      createdAt: new Date().toISOString(),
    };
    db.itineraries.set(itinerary.id, itinerary);
    return itinerary;
  }
}
