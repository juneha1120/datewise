import {
  Candidate,
  DateStyleOption,
  GenerateItineraryRequest,
  GenerateItineraryResponse,
  GenerateItineraryResponseSchema,
  ItineraryLeg,
} from '@datewise/shared';
import { Injectable } from '@nestjs/common';
import { DirectionsService } from './directions.service';
import { ScoredCandidate, ScoringService } from './scoring.service';

const MAX_CANDIDATE_POOL = 16;
const MAX_ROUTE_VALIDATION_ATTEMPTS = 4;

const STYLE_ANCHOR_SIGNALS: Readonly<Record<DateStyleOption, readonly string[]>> = {
  FOOD: ['restaurant', 'cafe', 'meal_takeaway', 'bakery', 'cozy', 'date_night'],
  ACTIVITY: ['museum', 'tourist_attraction', 'amusement_center', 'artsy', 'iconic'],
  EVENT: ['date_night', 'iconic', 'tourist_attraction'],
  SCENIC: ['park', 'nature', 'romantic', 'iconic', 'tourist_attraction'],
  SURPRISE: ['iconic', 'artsy', 'romantic', 'nature', 'cozy'],
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalize(values: readonly string[] | undefined): Set<string> {
  return new Set((values ?? []).map((value) => value.trim().toLowerCase()));
}

/** Returns deterministic target stop count bounded by trip duration and available candidates. */
export function determineStopCount(durationMin: number, availableCandidates: number): number {
  const requested = durationMin < 180 ? 2 : durationMin < 240 ? 3 : 4;
  return clamp(Math.min(requested, availableCandidates), 2, 4);
}

/** Picks a date-style anchor candidate from pre-ranked candidates. */
export function pickAnchorCandidate(dateStyle: DateStyleOption, ranked: readonly ScoredCandidate[]): ScoredCandidate | undefined {
  const anchorSignals = STYLE_ANCHOR_SIGNALS[dateStyle];

  return [...ranked]
    .map((item) => {
      const signals = normalize([...(item.candidate.types ?? []), ...(item.candidate.tags ?? [])]);
      const anchorMatches = anchorSignals.filter((signal) => signals.has(signal)).length;
      const anchorScore = anchorMatches / anchorSignals.length;

      return {
        item,
        anchorScore,
      };
    })
    .sort((left, right) => {
      if (right.anchorScore !== left.anchorScore) {
        return right.anchorScore - left.anchorScore;
      }

      if (right.item.breakdown.styleVibeScore !== left.item.breakdown.styleVibeScore) {
        return right.item.breakdown.styleVibeScore - left.item.breakdown.styleVibeScore;
      }

      if (right.item.score !== left.item.score) {
        return right.item.score - left.item.score;
      }

      return left.item.candidate.externalId.localeCompare(right.item.candidate.externalId);
    })[0]?.item;
}

const MAX_INTER_STOP_DISTANCE_M = 2_000;

/** Validates that every routed leg stays inside the nearby radius. */
export function hasOnlyNearbyLegs(legs: readonly ItineraryLeg[]): boolean {
  return legs.every((leg) => leg.distanceM <= MAX_INTER_STOP_DISTANCE_M);
}

function buildReason(item: ScoredCandidate, request: GenerateItineraryRequest, stopIndex: number): string {
  const snippets: string[] = [];

  if (item.breakdown.styleVibeScore >= 0.45) {
    snippets.push(`Strong ${request.dateStyle.toLowerCase()} + ${request.vibe.toLowerCase()} match`);
  }

  if (item.breakdown.qualityScore >= 0.7) {
    snippets.push('high rating and review confidence');
  }

  if (item.breakdown.fitScore >= 0.55) {
    snippets.push('good fit for your budget and travel range');
  }

  const topTags = (item.candidate.tags ?? []).slice(0, 2);
  if (topTags.length > 0) {
    snippets.push(`tags: ${topTags.join(', ')}`);
  }

  if (stopIndex > 0 && item.breakdown.diversityPenalty <= 0.33) {
    snippets.push('adds variety to the date flow');
  }

  return snippets.length > 0 ? snippets.slice(0, 2).join('; ') : 'Balanced pick from nearby ranked places.';
}

function removeRejectedCandidate(
  selected: readonly Candidate[],
  rankedPool: readonly ScoredCandidate[],
  rejectedExternalIds: Set<string>,
): void {
  for (let index = selected.length - 1; index > 0; index -= 1) {
    const candidateId = selected[index]?.externalId;
    if (!candidateId) {
      continue;
    }

    const hasBackupCandidate = rankedPool.some(
      (item) => item.candidate.externalId !== candidateId && !rejectedExternalIds.has(item.candidate.externalId),
    );

    if (hasBackupCandidate) {
      rejectedExternalIds.add(candidateId);
      return;
    }
  }
}

@Injectable()
export class ItineraryBuilder {
  constructor(
    private readonly scoringService: ScoringService,
    private readonly directionsService: DirectionsService,
  ) {}

  private pickStops(
    request: GenerateItineraryRequest,
    candidatePool: readonly ScoredCandidate[],
    stopCount: number,
    rejectedExternalIds: ReadonlySet<string>,
  ): Candidate[] {
    const filteredPool = candidatePool.filter((item) => !rejectedExternalIds.has(item.candidate.externalId));

    const anchor = pickAnchorCandidate(request.dateStyle, filteredPool);
    const selected: Candidate[] = [];

    if (anchor) {
      selected.push(anchor.candidate);
    }

    while (selected.length < stopCount) {
      const remaining = filteredPool
        .map((item) => item.candidate)
        .filter((candidate) => !selected.some((picked) => picked.externalId === candidate.externalId));

      if (remaining.length === 0) {
        break;
      }

      const next = this.scoringService.scoreCandidates({
        origin: request.origin,
        budget: request.budget,
        dateStyle: request.dateStyle,
        vibe: request.vibe,
        avoid: request.avoid,
        transport: request.transport,
        selected,
        candidates: remaining,
      })[0];

      if (!next) {
        break;
      }

      selected.push(next.candidate);
    }

    return selected;
  }

  /** Builds an itinerary with routed legs and per-stop proximity validation. */
  async build(request: GenerateItineraryRequest, candidates: readonly Candidate[]): Promise<GenerateItineraryResponse> {
    const initialRanked = this.scoringService.scoreCandidates({
      origin: request.origin,
      budget: request.budget,
      dateStyle: request.dateStyle,
      vibe: request.vibe,
      avoid: request.avoid,
      transport: request.transport,
      candidates,
    });

    const candidatePool = initialRanked.slice(0, MAX_CANDIDATE_POOL);
    const stopCount = determineStopCount(request.durationMin, candidatePool.length);
    const warnings: string[] = [];
    const rejectedExternalIds = new Set<string>();

    let selected: Candidate[] = [];
    let legs: ItineraryLeg[] = [];
    let walkingDistanceM = 0;

    for (let attempt = 0; attempt < MAX_ROUTE_VALIDATION_ATTEMPTS; attempt += 1) {
      selected = this.pickStops(request, candidatePool, stopCount, rejectedExternalIds);

      legs = [];
      walkingDistanceM = 0;
      const transport = request.transport ?? 'TRANSIT';

      for (let index = 0; index < selected.length - 1; index += 1) {
        const leg = await this.directionsService.routeLeg(selected[index], selected[index + 1], transport);
        walkingDistanceM += leg.walkingDistanceM;

        legs.push({
          from: index,
          to: index + 1,
          mode: leg.mode,
          durationMin: leg.durationMin,
          distanceM: leg.distanceM,
        });
      }

      if (hasOnlyNearbyLegs(legs)) {
        break;
      }

      removeRejectedCandidate(selected, candidatePool, rejectedExternalIds);
    }

    if (!hasOnlyNearbyLegs(legs)) {
      warnings.push('Unable to keep every stop-to-stop route within 2km using available nearby candidates.');
    }

    const finalRanked = this.scoringService.scoreCandidates({
      origin: request.origin,
      budget: request.budget,
      dateStyle: request.dateStyle,
      vibe: request.vibe,
      avoid: request.avoid,
      transport: request.transport,
      selected: [],
      candidates: selected,
    });

    const finalRankedByExternalId = new Map(finalRanked.map((item) => [item.candidate.externalId, item]));

    const orderedFinalRanked = selected
      .map((candidate) => finalRankedByExternalId.get(candidate.externalId))
      .filter((item): item is ScoredCandidate => item !== undefined);

    const stops = orderedFinalRanked.map((item, index) => ({
      kind: item.candidate.kind,
      name: item.candidate.name,
      lat: item.candidate.lat,
      lng: item.candidate.lng,
      address: item.candidate.address ?? 'Singapore',
      url: `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(item.candidate.externalId)}`,
      rating: item.candidate.rating ?? 4,
      reviewCount: item.candidate.reviewCount ?? 0,
      priceLevel: item.candidate.priceLevel ?? 2,
      tags: item.candidate.tags ?? [],
      reason: buildReason(item, request, index),
    }));

    if (stops.length < stopCount) {
      warnings.push('Not enough ranked candidates to fill the target stop count.');
    }

    return GenerateItineraryResponseSchema.parse({
      itineraryId: `iti_${request.date}_${request.startTime.replace(':', '')}_${request.origin.placeId}`,
      stops,
      legs,
      totals: {
        durationMin: request.durationMin,
        walkingDistanceM,
      },
      meta: {
        usedCache: false,
        warnings,
      },
    });
  }
}
