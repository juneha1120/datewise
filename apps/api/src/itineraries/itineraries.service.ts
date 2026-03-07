import {
  CoreGroup,
  GenerateItineraryConflictResponse,
  GenerateItineraryRequest,
  GenerateItineraryResponse,
  GenerateItineraryResult,
  ItineraryLeg,
  ItineraryStop,
  SequenceSlot,
  Subgroup,
} from '@datewise/shared';
import { Injectable } from '@nestjs/common';

import { PlaceVerificationDetails, PlacesService, SlotSearchCandidate } from '../places/places.service';
import { DirectionsService } from './directions.service';
import { verifyCoreCandidate, verifySubgroupCandidate, VerificationResult } from './membershipVerifier';
import { avoidToSubgroups, isOpenAtDateTime, openScoreFromState, radiusConfig, resolveSlotSubgroups, similarSuggestions, subgroupDurationMin, SUBGROUP_CORE } from './planner';
import { ScoringService } from './scoring.service';
import { CORE_ANCHORS, PROFILES, RetrievalMode } from './subgroupProfiles';

const MAX_SUBGROUP_OPTIONS_PER_SLOT = 6;
const MAX_CANDIDATES_PER_SUBGROUP = 20;
const MAX_DETAILS_PER_SUBGROUP = 10;
const MAX_LOOKAHEAD_CURRENT_CHOICES = 3;
const MAX_LOOKAHEAD_SUBGROUPS = 3;
const MAX_LOOKAHEAD_CANDIDATES = 3;

type SlotPick = {
  subgroup: Subgroup;
  place: SlotSearchCandidate;
  matchConfidence: number;
  matchReasons: string[];
  openState: 'OPEN' | 'UNKNOWN' | 'CLOSED';
  score: number;
};
type CandidateEvaluation = SlotPick & {
  leg: { durationMin: number; distanceM: number; mode: ItineraryLeg['mode']; walkingDistanceM: number };
};

type ReplaceStopWithTextSearchRequest = {
  originPlaceId: string;
  stopIndex: number;
  query: string;
  itinerary: GenerateItineraryResponse;
};

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

  async replaceStopWithTextSearch(request: ReplaceStopWithTextSearchRequest): Promise<GenerateItineraryResponse> {
    const warnings = [...(request.itinerary.meta.warnings ?? [])];
    warnings.push(`replace-stop is deprecated; received query "${request.query}" for stop ${request.stopIndex}. Returning itinerary unchanged.`);

    return {
      ...request.itinerary,
      meta: {
        ...request.itinerary.meta,
        warnings,
      },
    };
  }

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
      const slot = request.sequence[i];
      const options = this.limitSlotSubgroups(resolveSlotSubgroups(slot, avoid));
      if (options.length === 0) return this.conflict('ALL_BLOCKED_BY_AVOID', 'Avoid list removed all candidates for slot.', request, i, undefined, avoid);

      let best: CandidateEvaluation | undefined;
      let foundTooFar = false;
      let foundClosed = false;
      const evaluated: CandidateEvaluation[] = [];

      for (const subgroup of options) {
        const candidates = await this.fetchCandidatesForSubgroup(subgroup, nowLatLng, radius.maxLegKm);

        for (const candidate of candidates.slice(0, MAX_CANDIDATES_PER_SUBGROUP)) {
          const leg = await this.directionsService.routeLeg(nowLatLng, { lat: candidate.lat, lng: candidate.lng }, request.radiusMode);
          if (leg.distanceM > radius.maxLegKm * 1000) {
            foundTooFar = true;
            continue;
          }

          const arrivalTime = addMinutes(request.startTime, elapsedMin + leg.durationMin);
          const details = await this.placesService.placeVerificationDetails(candidate.externalId);
          const verification = this.verifyForSlot(slot, subgroup, candidate, details);
          if (!verification.accepted) continue;

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
            matchConfidence: verification.confidence,
          }) + 0.1 * verification.confidence;

          evaluated.push({
            subgroup,
            place: candidate,
            matchConfidence: verification.confidence,
            matchReasons: verification.evidence.reasons,
            openState,
            score,
            leg,
          });
        }
      }

      evaluated.sort((a, b) => b.score - a.score);
      best = evaluated[0];

      if (i < request.sequence.length - 1) {
        const nextOptions = this.limitSlotSubgroups(resolveSlotSubgroups(request.sequence[i + 1], avoid));
        const feasible = await this.findFirstWithFeasibleNextStop({
          request,
          currentSlotIndex: i,
          nowElapsedMin: elapsedMin,
          nowOptions: evaluated,
          nextSlot: request.sequence[i + 1],
          nextOptions,
          maxLegKm: radius.maxLegKm,
        });

        if (feasible) {
          best = feasible;
        }
      }

      if (!best) {
        const reason = foundClosed ? 'CLOSED_AT_TIME' : foundTooFar ? 'ONLY_CANDIDATES_TOO_FAR' : 'NO_CANDIDATES_WITHIN_RADIUS';
        return this.conflict(reason, 'Unable to find a feasible place for slot.', request, i, options[0], avoid);
      }

      elapsedMin += best.leg.durationMin;
      totalTravelMin += best.leg.durationMin;
      walkingDistanceM += best.leg.walkingDistanceM;
      elapsedMin += subgroupDurationMin(best.subgroup);

      picks.push(best);
      nowLatLng = { lat: best.place.lat, lng: best.place.lng };
      if (i > 0) legs.push({ from: i - 1, to: i, mode: best.leg.mode, durationMin: best.leg.durationMin, distanceM: best.leg.distanceM });
    }

    const totalDurationMin = elapsedMin;

    if (totalTravelMin > Math.floor(totalDurationMin * 0.25)) {
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
        meta: {
          matchConfidence: pick.matchConfidence,
          matchReasons: pick.matchReasons,
        },
      };
    });

    return {
      status: 'OK',
      itineraryId: `iti_${request.date}_${request.startTime.replace(':', '')}_${request.origin.placeId}`,
      stops,
      legs,
      totals: { durationMin: totalDurationMin, durationLabel: this.formatDuration(totalDurationMin), walkingDistanceM },
      meta: {
        usedCache: false,
        warnings: [],
        totalTravelTimeMin: totalTravelMin,
        travelTimeRatio: totalDurationMin > 0 ? Number((totalTravelMin / totalDurationMin).toFixed(3)) : 0,
      },
    };
  }

  private verifyForSlot(slot: SequenceSlot, subgroup: Subgroup, candidate: SlotSearchCandidate, details: PlaceVerificationDetails): VerificationResult {
    const merged = {
      name: details.name || candidate.name,
      primaryType: details.primaryType ?? candidate.primaryType,
      types: [...(candidate.types ?? []), ...details.types],
      editorialSummary: [candidate.editorialSummary, details.editorialSummary].filter((value): value is string => Boolean(value)).join(' '),
      reviews: details.reviews,
    };

    if (slot.type === 'SUBGROUP') {
      return verifySubgroupCandidate(subgroup, merged, PROFILES);
    }

    return verifyCoreCandidate(slot.core, merged, CORE_ANCHORS);
  }

  private async fetchCandidatesForSubgroup(subgroup: Subgroup, origin: { lat: number; lng: number }, maxLegKm: number): Promise<SlotSearchCandidate[]> {
    const profile = PROFILES[subgroup];
    const mode: RetrievalMode = profile?.retrievalMode ?? 'TEXT';
    const requests: Promise<SlotSearchCandidate[]>[] = [];
    const addTypeSearch = (): void => {
      requests.push(this.placesService.searchForSubgroup({ origin, subgroup, maxLegKm, requiredTypes: profile?.googleTypes ?? profile?.requiredTypesAny ?? ['point_of_interest'] }));
    };
    const addTextSearch = (): void => {
      const textQuery = profile?.textQueries && profile.textQueries.length > 0 ? profile.textQueries[0] : subgroup.toLowerCase().replaceAll('_', ' ');
      requests.push(this.placesService.searchForSubgroup({ origin, subgroup, maxLegKm, textQuery }));
    };

    if (mode === 'TYPE') addTypeSearch();
    if (mode === 'TEXT') addTextSearch();
    if (mode === 'HYBRID') {
      addTypeSearch();
      addTextSearch();
    }

    const results = (await Promise.all(requests)).flat();
    const unique = new Map<string, SlotSearchCandidate>();
    for (const result of results) {
      if (!unique.has(result.externalId)) unique.set(result.externalId, result);
    }
    return [...unique.values()].slice(0, MAX_DETAILS_PER_SUBGROUP);
  }

  private async findFirstWithFeasibleNextStop(input: {
    request: GenerateItineraryRequest;
    currentSlotIndex: number;
    nowElapsedMin: number;
    nowOptions: CandidateEvaluation[];
    nextSlot: SequenceSlot;
    nextOptions: Subgroup[];
    maxLegKm: number;
  }): Promise<CandidateEvaluation | undefined> {
    const { request, nowOptions, nextOptions, maxLegKm, nowElapsedMin, nextSlot } = input;
    if (nextOptions.length === 0) return undefined;

    for (const current of nowOptions.slice(0, MAX_LOOKAHEAD_CURRENT_CHOICES)) {
      const afterCurrentStopMin = nowElapsedMin + current.leg.durationMin + subgroupDurationMin(current.subgroup);
      const currentPoint = { lat: current.place.lat, lng: current.place.lng };

      for (const nextSubgroup of nextOptions.slice(0, MAX_LOOKAHEAD_SUBGROUPS)) {
        const nextCandidates = await this.fetchCandidatesForSubgroup(nextSubgroup, currentPoint, maxLegKm);

        for (const nextCandidate of nextCandidates.slice(0, MAX_LOOKAHEAD_CANDIDATES)) {
          const nextLeg = await this.directionsService.routeLeg(currentPoint, { lat: nextCandidate.lat, lng: nextCandidate.lng }, request.radiusMode);
          if (nextLeg.distanceM > maxLegKm * 1000) continue;

          const nextArrival = addMinutes(request.startTime, afterCurrentStopMin + nextLeg.durationMin);
          const details = await this.placesService.placeVerificationDetails(nextCandidate.externalId);
          if (!this.verifyForSlot(nextSlot, nextSubgroup, nextCandidate, details).accepted) continue;

          if (openScoreFromState(isOpenAtDateTime(details.regularOpeningPeriods, request.date, nextArrival)) > 0) {
            return current;
          }
        }
      }
    }

    return undefined;
  }

  private limitSlotSubgroups(options: Subgroup[]): Subgroup[] {
    if (options.length <= MAX_SUBGROUP_OPTIONS_PER_SLOT) return options;
    return options.slice(0, MAX_SUBGROUP_OPTIONS_PER_SLOT);
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

  private formatDuration(totalMin: number): string {
    const hours = Math.floor(totalMin / 60);
    const minutes = totalMin % 60;
    if (hours > 0 && minutes > 0) return `${hours} hour${hours === 1 ? '' : 's'} ${minutes} min`;
    if (hours > 0) return `${hours} hour${hours === 1 ? '' : 's'}`;
    return `${minutes} min`;
  }
}
