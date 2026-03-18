import { BadRequestException, Injectable } from '@nestjs/common';
import {
  DURATION_BY_CORE,
  type GenerateItineraryInput,
  type ItinerarySlot,
  type RegenerateSlotInput,
  detectConflict,
  expandSelection,
  generateItineraryInputSchema,
  itinerarySlotSchema,
  regenerateSlotInputSchema,
  resolveCore,
  type SlotType,
  isSubgroup,
} from '@datewise/shared';
import { randomUUID } from 'node:crypto';
import { db } from '../db';
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

  private subgroupCandidates(selection: SlotType, avoided: Set<string>) {
    const expanded = expandSelection(selection).filter((entry) => !avoided.has(entry));
    if (expanded.length === 0) throw new BadRequestException('No allowed subgroup candidates');
    return isSubgroup(selection) ? expanded : expanded.slice(0, 4);
  }

  private async pickBest(selection: SlotType, cursor: { lat: number; lng: number }, arrival: Date, blockedPlaceIds: Set<string>, avoided: Set<string>) {
    const candidateSubgroups = this.subgroupCandidates(selection, avoided);
    const scored: Array<{ subgroup: string; candidate: Awaited<ReturnType<PlacesProvider['search']>>[number]; score: number; travelMinutes: number }> = [];

    for (const subgroup of candidateSubgroups) {
      const candidates = await this.places.search(subgroup, cursor, arrival);
      for (const candidate of candidates) {
        if (!candidate.isOpen || blockedPlaceIds.has(candidate.placeId)) continue;
        const travelMinutes = this.places.travelMinutes(cursor, candidate);
        const relevance = this.tagging.relevanceScore(subgroup, candidate.name);
        scored.push({
          subgroup,
          candidate,
          travelMinutes,
          score: this.scoring.score({ relevance, travelMinutes, rating: candidate.rating }),
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    if (!scored[0]) throw new BadRequestException('No candidate found for slot');
    return scored[0];
  }

  async generate(input: GenerateItineraryInput): Promise<ItinerarySlot[]> {
    const parsed = generateItineraryInputSchema.parse(input);
    const conflicts = detectConflict(parsed.slots, parsed.avoidSlots);
    if (conflicts.length > 0) throw new BadRequestException({ message: 'Slot conflict', conflicts });

    const baseDateTime = combineDateTime(parsed.date, parsed.time);
    const avoided = new Set(parsed.avoidSlots.flatMap((item) => expandSelection(item)));
    const usedPlaceIds = new Set<string>();
    let cursor = { lat: parsed.startPoint.latitude, lng: parsed.startPoint.longitude };
    let currentMinutes = 0;
    const slots: ItinerarySlot[] = [];

    for (const [slotIndex, selection] of parsed.slots.entries()) {
      const arrivalAtSearch = addMinutes(baseDateTime, currentMinutes);
      const picked = await this.pickBest(selection, cursor, arrivalAtSearch, usedPlaceIds, avoided);
      const travelMinutes = slotIndex === 0 ? 0 : picked.travelMinutes;
      currentMinutes += travelMinutes;
      const arrival = addMinutes(baseDateTime, currentMinutes);
      const durationMin = DURATION_BY_CORE[resolveCore(selection)];
      const departure = addMinutes(arrival, durationMin);

      slots.push({
        slotIndex,
        slotType: selection as SlotType,
        subgroup: picked.subgroup,
        travelMinutes,
        arrivalTime: arrival.toISOString(),
        departureTime: departure.toISOString(),
        place: {
          name: picked.candidate.name,
          placeId: picked.candidate.placeId,
          latitude: picked.candidate.lat,
          longitude: picked.candidate.lng,
          address: picked.candidate.address,
          rating: picked.candidate.rating,
        },
      });

      currentMinutes += durationMin;
      cursor = { lat: picked.candidate.lat, lng: picked.candidate.lng };
      usedPlaceIds.add(picked.candidate.placeId);
    }

    return slots;
  }

  async regenerateSlot(input: RegenerateSlotInput): Promise<ItinerarySlot> {
    const parsed = regenerateSlotInputSchema.parse(input);
    if (parsed.slotIndex >= parsed.slots.length) throw new BadRequestException('Invalid slot index');

    const base = await this.generate(parsed);
    const current = base[parsed.slotIndex];
    const blocked = new Set(parsed.existingPlaceIds);
    blocked.add(current.place.placeId);

    const previous = parsed.slotIndex === 0 ? parsed.startPoint : base[parsed.slotIndex - 1].place;
    const arrival = parsed.slotIndex === 0 ? new Date(`${parsed.date}T${parsed.time}:00`) : new Date(base[parsed.slotIndex - 1].departureTime);
    const avoided = new Set(parsed.avoidSlots.flatMap((item) => expandSelection(item)));
    const picked = await this.pickBest(parsed.slots[parsed.slotIndex] as SlotType, { lat: previous.latitude, lng: previous.longitude }, arrival, blocked, avoided);

    return {
      ...current,
      subgroup: picked.subgroup,
      travelMinutes: parsed.slotIndex === 0 ? 0 : picked.travelMinutes,
      place: {
        name: picked.candidate.name,
        placeId: picked.candidate.placeId,
        latitude: picked.candidate.lat,
        longitude: picked.candidate.lng,
        address: picked.candidate.address,
        rating: picked.candidate.rating,
      },
    };
  }

  async saveGenerated(userId: string, input: GenerateItineraryInput, result: ItinerarySlot[], isPublic: boolean) {
    const parsedInput = generateItineraryInputSchema.parse(input);
    // Validate client payload for compatibility while persisting a server-generated canonical result.
    itinerarySlotSchema.array().parse(result);
    const normalizedResult = await this.generate(parsedInput);
    const now = new Date().toISOString();
    const itinerary = {
      id: randomUUID(),
      userId,
      input: parsedInput,
      result: normalizedResult,
      isPublic,
      createdAt: now,
      updatedAt: now,
      editedAfterGeneration: false,
      sourceItineraryId: null,
    };
    db.itineraries.set(itinerary.id, itinerary);
    return itinerary;
  }
}
