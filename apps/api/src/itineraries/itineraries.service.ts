import {
  GenerateItineraryConflictResponse,
  GenerateItineraryRequest,
  GenerateItineraryResponse,
  GenerateItineraryResult,
  ItineraryLeg,
  ItineraryStop,
  Subgroup,
} from '@datewise/shared';
import { Injectable } from '@nestjs/common';
import { PlaceVerificationDetails, PlacesService, SlotSearchCandidate } from '../places/places.service';
import { DirectionsService } from './directions.service';
import { ScoringService } from './scoring.service';
import {
  SUBGROUP_CORE,
  SUBGROUP_KEYWORDS,
  avoidToSubgroups,
  isOpenAtDateTime,
  openScoreFromState,
  radiusConfig,
  resolveSlotSubgroups,
  similarSuggestions,
  subgroupDurationMin,
} from './planner';

const FORBIDDEN_EAT_PRIMARY_TYPES = new Set(['shopping_mall', 'department_store', 'tourist_attraction', 'lodging']);
const EAT_NAME_BLOCKLIST = [' mall ', ' plaza ', ' centre ', ' center '];

type SlotPick = { subgroup: Subgroup; place: SlotSearchCandidate; matchConfidence: number; openState: 'OPEN' | 'UNKNOWN' | 'CLOSED'; score: number };

const TYPE_MAP: Partial<Record<Subgroup, readonly string[]>> = {
  COFFEE: ['cafe'], DESSERT: ['bakery'], COCKTAIL: ['bar'], WINE: ['bar'], BEER: ['bar'], SPIRIT: ['bar'],
  MUSEUM: ['museum'], GALLERY: ['art_gallery'], EXHIBITION: ['art_gallery'], SHOPPING: ['shopping_mall'], WELLNESS: ['spa'], CINEMA: ['movie_theater'], WALK_IN_PARK: ['park'], SCENIC_WALK: ['park'], ARCADE: ['amusement_center'], BOWLING: ['bowling_alley'], INDOOR_SPORTS: ['sports_complex'], OUTDOOR_ACTIVITY: ['park'], ATTRACTION: ['tourist_attraction'],
  JAPANESE: ['restaurant'], KOREAN: ['restaurant'], CHINESE: ['restaurant'], THAI: ['restaurant'], WESTERN: ['restaurant'], ITALIAN: ['restaurant'], INDIAN: ['restaurant'], MALAY: ['restaurant'], INDONESIAN: ['restaurant'], VIETNAMESE: ['restaurant'], MIDDLE_EASTERN: ['restaurant'], SEAFOOD: ['restaurant'], LOCAL: ['restaurant'], HAWKER: ['restaurant'],
};
const TEXT_QUERY_MAP: Partial<Record<Subgroup, string>> = { ESCAPE_ROOM: 'escape room', KARAOKE: 'karaoke', CLASSES: 'classes', TEA_HOUSE: 'tea house', BUBBLE_TEA: 'bubble tea' };

function clamp(v: number): number { return Math.max(0, Math.min(1, v)); }

function addMinutes(time: string, minutesToAdd: number): string {
  const [hour, minute] = time.split(':').map((part) => Number(part));
  const total = (hour * 60 + minute + minutesToAdd) % (24 * 60);
  const normalized = total < 0 ? total + 24 * 60 : total;
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

@Injectable()
export class ItinerariesService {
  constructor(
    private readonly placesService: PlacesService,
    private readonly directionsService: DirectionsService,
    private readonly scoringService: ScoringService,
  ) {}

  async generateItinerary(request: GenerateItineraryRequest): Promise<GenerateItineraryResult> {
    const origin = await this.placesService.details(request.origin.placeId);
    const avoid = avoidToSubgroups(request.avoid ?? []);
    const radius = radiusConfig(request.radiusMode);
    const picks: SlotPick[] = [];
    const legs: ItineraryLeg[] = [];
    let nowLatLng = { lat: origin.lat, lng: origin.lng };
    let elapsedMin = 0;
    let totalTravelMin = 0;
    let walkingDistanceM = 0;

    for (let i = 0; i < request.sequence.length; i += 1) {
      const options = resolveSlotSubgroups(request.sequence[i], avoid);
      if (options.length === 0) return this.conflict('ALL_BLOCKED_BY_AVOID', 'Avoid list removed all candidates for slot.', request, i, undefined, avoid);

      let best: SlotPick | undefined;
      let foundTooFar = false;
      let foundClosed = false;

      for (const subgroup of options) {
        const candidates = await this.placesService.searchForSubgroup({
          origin: nowLatLng,
          subgroup,
          maxLegKm: radius.maxLegKm,
          requiredTypes: TYPE_MAP[subgroup],
          textQuery: TEXT_QUERY_MAP[subgroup],
        });

        for (const candidate of candidates.slice(0, 20).slice(0, 10)) {
          const leg = await this.directionsService.routeLeg(nowLatLng, { lat: candidate.lat, lng: candidate.lng }, request.radiusMode);
          if (leg.distanceM > radius.maxLegKm * 1000) {
            foundTooFar = true;
            continue;
          }

          const arrivalTime = addMinutes(request.startTime, elapsedMin + leg.durationMin);
          const details = await this.placesService.placeVerificationDetails(candidate.externalId);
          const matchConfidence = this.matchConfidence(subgroup, candidate, details);
          if (matchConfidence < 0.6) continue;

          const openState = isOpenAtDateTime(details.regularOpeningPeriods, request.date, arrivalTime);
          const openScore = openScoreFromState(openState);
          if (openScore === 0) {
            foundClosed = true;
            continue;
          }

          const score = this.scoringService.scoreCandidate({
            distanceM: leg.distanceM,
            maxLegKm: radius.maxLegKm,
            rating: candidate.rating,
            reviewCount: candidate.reviewCount,
            priceLevel: candidate.priceLevel,
            budgetLevel: request.budgetLevel,
            openScore,
            matchConfidence,
          });

          if (!best || score > best.score) {
            best = { subgroup, place: candidate, matchConfidence, openState, score };
          }
        }
      }

      if (!best) {
        const reason = foundClosed ? 'CLOSED_AT_TIME' : foundTooFar ? 'ONLY_CANDIDATES_TOO_FAR' : 'NO_CANDIDATES_WITHIN_RADIUS';
        return this.conflict(reason, 'Unable to find a feasible place for slot.', request, i, options[0], avoid);
      }

      const leg = await this.directionsService.routeLeg(nowLatLng, { lat: best.place.lat, lng: best.place.lng }, request.radiusMode);
      elapsedMin += leg.durationMin;
      totalTravelMin += leg.durationMin;
      walkingDistanceM += leg.walkingDistanceM;
      elapsedMin += subgroupDurationMin(best.subgroup);
      if (elapsedMin > request.durationMin) return this.conflict('INSUFFICIENT_TIME_FOR_TRAVEL', 'Travel and stops exceed total duration.', request, i, best.subgroup, avoid);

      picks.push(best);
      nowLatLng = { lat: best.place.lat, lng: best.place.lng };
      if (i > 0) legs.push({ from: i - 1, to: i, mode: leg.mode, durationMin: leg.durationMin, distanceM: leg.distanceM });
    }

    if (totalTravelMin > Math.floor(request.durationMin * 0.25)) {
      return this.conflict('INSUFFICIENT_TIME_FOR_TRAVEL', 'Travel time would exceed 25% of total duration.', request, 0, undefined, avoid);
    }

    let runningTime = 0;
    const stops: ItineraryStop[] = picks.map((pick, index) => {
      const inboundLeg = index === 0 ? 0 : (legs[index - 1]?.durationMin ?? 0);
      runningTime += inboundLeg;
      const arrivalTime = addMinutes(request.startTime, runningTime);
      runningTime += subgroupDurationMin(pick.subgroup);
      const departTime = addMinutes(request.startTime, runningTime);

      return {
        kind: 'PLACE',
        name: pick.place.name,
        lat: pick.place.lat,
        lng: pick.place.lng,
        address: pick.place.address ?? 'Singapore',
        url: `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(pick.place.externalId)}`,
        rating: pick.place.rating ?? 4,
        reviewCount: pick.place.reviewCount ?? 0,
        priceLevel: pick.place.priceLevel ?? 2,
        tags: [],
        reason: `Matched ${pick.subgroup.toLowerCase().replaceAll('_', ' ')} with confidence ${pick.matchConfidence.toFixed(2)} and open-hours state ${pick.openState.toLowerCase()}.`,
        core: SUBGROUP_CORE[pick.subgroup],
        subgroup: pick.subgroup,
        arrivalTime,
        departTime,
        matchConfidence: pick.matchConfidence,
      };
    });

    const response: GenerateItineraryResponse = {
      status: 'OK',
      itineraryId: `iti_${request.date}_${request.startTime.replace(':', '')}_${request.origin.placeId}`,
      stops,
      legs,
      totals: { durationMin: request.durationMin, walkingDistanceM },
      meta: { usedCache: false, warnings: [], totalTravelTimeMin: totalTravelMin },
    };

    return response;
  }

  async replaceStopWithTextSearch(_request?: unknown): Promise<GenerateItineraryResponse> {
    throw new Error('replace-stop-with-text-search is deprecated for refined itinerary model');
  }

  private matchConfidence(subgroup: Subgroup, candidate: SlotSearchCandidate, details: PlaceVerificationDetails): number {
    const types = new Set([...(candidate.types ?? []), ...details.types].map((type) => type.toLowerCase()));
    const required = (TYPE_MAP[subgroup] ?? []).map((type) => type.toLowerCase());
    const requiredHit = required.length === 0 ? 0.7 : required.some((type) => types.has(type)) ? 1 : 0;

    if (SUBGROUP_CORE[subgroup] === 'EAT') {
      const primary = (details.primaryType ?? candidate.primaryType ?? '').toLowerCase();
      const normalizedName = ` ${candidate.name.toLowerCase()} ${details.name.toLowerCase()} `;
      if (FORBIDDEN_EAT_PRIMARY_TYPES.has(primary)) return 0;
      if (EAT_NAME_BLOCKLIST.some((token) => normalizedName.includes(token))) return 0;
    }

    const keywordPool = `${candidate.name} ${candidate.editorialSummary ?? ''} ${details.editorialSummary ?? ''}`.toLowerCase();
    const keywords = SUBGROUP_KEYWORDS[subgroup];
    const keywordMatches = keywords.filter((keyword) => keywordPool.includes(keyword)).length;
    const keywordScore = keywords.length === 0 ? 0.5 : clamp(keywordMatches / Math.min(2, keywords.length));

    return clamp(requiredHit * 0.6 + keywordScore * 0.4);
  }

  private conflict(
    reason: GenerateItineraryConflictResponse['reason'],
    message: string,
    request: GenerateItineraryRequest,
    slotIndex: number,
    subgroup: Subgroup | undefined,
    avoid: Set<Subgroup>,
  ): GenerateItineraryConflictResponse {
    return {
      status: 'CONFLICT',
      reason,
      message,
      suggestions: [
        {
          type: 'UPGRADE_RADIUS_MODE',
          message: 'Try a wider radius mode.',
          recommendedRadiusMode: request.radiusMode === 'WALKABLE' ? 'SHORT_TRANSIT' : 'CAR_GRAB',
        },
        ...(subgroup
          ? [{ type: 'SUBSTITUTE_SUBGROUP' as const, message: 'Try nearby alternatives within the same core group.', slotIndex, fromSubgroup: subgroup, toSubgroups: similarSuggestions(subgroup, avoid) }]
          : []),
        ...(request.radiusMode === 'WALKABLE'
          ? []
          : [{ type: 'RECENTER_AROUND_SLOT' as const, message: 'Recenter itinerary around the difficult slot.', slotIndex }]),
      ],
    };
  }
}
