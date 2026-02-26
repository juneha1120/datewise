import {
  Candidate,
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
const MAX_NEARBY_DISTANCE_M = 2_000;

const VIBE_ANCHOR_SIGNALS: Readonly<Record<GenerateItineraryRequest['vibe'], readonly string[]>> = {
  CHILL: ['cozy', 'cafe', 'park', 'nature'],
  ROMANTIC: ['romantic', 'date_night', 'restaurant', 'bar'],
  CREATIVE: ['artsy', 'art_gallery', 'museum', 'workshop'],
  PLAYFUL: ['amusement_park', 'arcade', 'bowling_alley', 'iconic'],
  ACTIVE: ['nature', 'park', 'tourist_attraction', 'hiking_area'],
  LUXE: ['premium', 'bar', 'restaurant', 'iconic'],
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
export function pickAnchorCandidate(vibe: GenerateItineraryRequest['vibe'], ranked: readonly ScoredCandidate[]): ScoredCandidate | undefined {
  const anchorSignals = VIBE_ANCHOR_SIGNALS[vibe];

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

/** Validates that every routed leg stays inside the nearby radius. */
export function hasOnlyNearbyLegs(legs: readonly ItineraryLeg[]): boolean {
  return legs.every((leg) => leg.distanceM <= MAX_NEARBY_DISTANCE_M);
}

/** Ensures we have enough nearby candidates around the selected start point. */
export function filterCandidatesWithinOriginRadius(
  ranked: readonly ScoredCandidate[],
  maxDistanceM: number = MAX_NEARBY_DISTANCE_M,
): ScoredCandidate[] {
  return ranked.filter((item) => item.distanceM <= maxDistanceM);
}

function isRouteValidForStopCount(legs: readonly ItineraryLeg[], selectedCount: number, stopCount: number): boolean {
  return selectedCount >= stopCount && hasOnlyNearbyLegs(legs);
}

function haversineDistanceMeters(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (value: number): number => (value * Math.PI) / 180;

  const latDistanceRad = toRadians(to.lat - from.lat);
  const lngDistanceRad = toRadians(to.lng - from.lng);
  const fromLatRad = toRadians(from.lat);
  const toLatRad = toRadians(to.lat);

  const a =
    Math.sin(latDistanceRad / 2) * Math.sin(latDistanceRad / 2) +
    Math.cos(fromLatRad) * Math.cos(toLatRad) * Math.sin(lngDistanceRad / 2) * Math.sin(lngDistanceRad / 2);

  return Math.round(earthRadiusMeters * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))));
}

function isWithinNearbyRadius(from: { lat: number; lng: number }, to: { lat: number; lng: number }): boolean {
  return haversineDistanceMeters(from, to) <= MAX_NEARBY_DISTANCE_M;
}

function buildReason(item: ScoredCandidate, request: GenerateItineraryRequest, stopIndex: number): string {
  const snippets: string[] = [];

  if (item.breakdown.styleVibeScore >= 0.45) {
    snippets.push(`Strong ${request.vibe.toLowerCase()} vibe match`);
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

    const anchor = pickAnchorCandidate(request.vibe, filteredPool);
    const selected: Candidate[] = [];

    if (anchor) {
      selected.push(anchor.candidate);
    }

    while (selected.length < stopCount) {
      const lastSelected = selected[selected.length - 1];
      const remaining = filteredPool
        .map((item) => item.candidate)
        .filter((candidate) => !selected.some((picked) => picked.externalId === candidate.externalId))
        .filter((candidate) => {
          if (!lastSelected) {
            return true;
          }

          return isWithinNearbyRadius(
            { lat: lastSelected.lat, lng: lastSelected.lng },
            { lat: candidate.lat, lng: candidate.lng },
          );
        });

      if (remaining.length === 0) {
        break;
      }

      const next = this.scoringService.scoreCandidates({
        origin: request.origin,
        budget: request.budget,
        vibe: request.vibe,
        avoid: request.avoid,
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
      vibe: request.vibe,
      avoid: request.avoid,
      candidates,
    });

    const nearbyRanked = filterCandidatesWithinOriginRadius(initialRanked);
    const candidatePool = nearbyRanked.slice(0, MAX_CANDIDATE_POOL);
    const stopCount = determineStopCount(request.durationMin, candidatePool.length);
    const warnings: string[] = [];
    const rejectedExternalIds = new Set<string>();

    if (nearbyRanked.length < initialRanked.length) {
      warnings.push('Filtered out far candidates to enforce a strict 2km cap from your selected starting point.');
    }

    let selected: Candidate[] = [];
    let legs: ItineraryLeg[] = [];
    let walkingDistanceM = 0;

    for (let attempt = 0; attempt < MAX_ROUTE_VALIDATION_ATTEMPTS; attempt += 1) {
      selected = this.pickStops(request, candidatePool, stopCount, rejectedExternalIds);

      legs = [];
      walkingDistanceM = 0;
      for (let index = 0; index < selected.length - 1; index += 1) {
        const leg = await this.directionsService.routeLeg(selected[index], selected[index + 1]);
        walkingDistanceM += leg.walkingDistanceM;

        legs.push({
          from: index,
          to: index + 1,
          mode: leg.mode,
          durationMin: leg.durationMin,
          distanceM: leg.distanceM,
        });
      }

      if (isRouteValidForStopCount(legs, selected.length, stopCount)) {
        break;
      }

      removeRejectedCandidate(selected, candidatePool, rejectedExternalIds);
    }

    if (!isRouteValidForStopCount(legs, selected.length, stopCount)) {
      warnings.push('Unable to keep every stop-to-stop route within 2km using available nearby candidates.');
    }

    const finalRanked = this.scoringService.scoreCandidates({
      origin: request.origin,
      budget: request.budget,
      vibe: request.vibe,
      avoid: request.avoid,
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
      booking: item.candidate.booking,
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
