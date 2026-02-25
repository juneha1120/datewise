import {
  Candidate,
  DateStyleOption,
  GenerateItineraryRequest,
  GenerateItineraryResponse,
  GenerateItineraryResponseSchema,
  ItineraryLeg,
  Transport,
} from '@datewise/shared';
import { Injectable } from '@nestjs/common';
import { ScoredCandidate, ScoringService } from './scoring.service';

const MAX_CANDIDATE_POOL = 16;

const STYLE_ANCHOR_SIGNALS: Readonly<Record<DateStyleOption, readonly string[]>> = {
  FOOD: ['restaurant', 'cafe', 'meal_takeaway', 'bakery', 'cozy', 'date_night'],
  ACTIVITY: ['museum', 'tourist_attraction', 'amusement_center', 'artsy', 'iconic'],
  EVENT: ['date_night', 'iconic', 'tourist_attraction'],
  SCENIC: ['park', 'nature', 'romantic', 'iconic', 'tourist_attraction'],
  SURPRISE: ['iconic', 'artsy', 'romantic', 'nature', 'cozy'],
};

const MODE_BY_TRANSPORT: Readonly<Record<Transport, ItineraryLeg['mode']>> = {
  MIN_WALK: 'WALK',
  WALK_OK: 'WALK',
  TRANSIT: 'TRANSIT',
  DRIVE_OK: 'DRIVE',
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalize(values: readonly string[] | undefined): Set<string> {
  return new Set((values ?? []).map((value) => value.trim().toLowerCase()));
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

@Injectable()
export class ItineraryBuilder {
  constructor(private readonly scoringService: ScoringService) {}

  /** Builds a places-only itinerary from candidates using deterministic scoring and anchor-first assembly. */
  build(request: GenerateItineraryRequest, candidates: readonly Candidate[]): GenerateItineraryResponse {
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

    const anchor = pickAnchorCandidate(request.dateStyle, candidatePool);
    const selected: Candidate[] = [];

    if (anchor) {
      selected.push(anchor.candidate);
    }

    while (selected.length < stopCount) {
      const remaining = candidatePool
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

    const stops = finalRanked.map((item, index) => ({
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

    const legMode = MODE_BY_TRANSPORT[request.transport ?? 'TRANSIT'];
    const legs = stops.slice(0, -1).map((stop, index) => {
      const next = stops[index + 1];
      const distanceM = haversineDistanceMeters(
        { lat: stop.lat, lng: stop.lng },
        { lat: next.lat, lng: next.lng },
      );

      const speedMetersPerMin = legMode === 'WALK' ? 80 : legMode === 'DRIVE' ? 500 : 300;
      const durationMin = Math.max(1, Math.round(distanceM / speedMetersPerMin));

      return {
        from: index,
        to: index + 1,
        mode: legMode,
        durationMin,
        distanceM: Math.max(1, distanceM),
      } satisfies ItineraryLeg;
    });

    const warnings: string[] = [];
    if (stops.length < stopCount) {
      warnings.push('Not enough ranked candidates to fill the target stop count.');
    }

    return GenerateItineraryResponseSchema.parse({
      itineraryId: `iti_${request.date}_${request.startTime.replace(':', '')}_${request.origin.placeId}`,
      stops,
      legs,
      totals: {
        durationMin: request.durationMin,
        walkingDistanceM: legs.filter((leg) => leg.mode === 'WALK').reduce((sum, leg) => sum + leg.distanceM, 0),
      },
      meta: {
        usedCache: false,
        warnings,
      },
    });
  }
}
