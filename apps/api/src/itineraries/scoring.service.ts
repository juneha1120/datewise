import { Injectable } from '@nestjs/common';
import { AvoidPreference, Budget, Candidate, VibeOption } from '@datewise/shared';

export type ScoringBreakdown = {
  qualityScore: number;
  fitScore: number;
  styleVibeScore: number;
  avoidPenalty: number;
  diversityPenalty: number;
};

export type ScoredCandidate = {
  candidate: Candidate;
  score: number;
  breakdown: ScoringBreakdown;
  distanceM: number;
};

export type ScoreCandidatesInput = {
  origin: {
    lat: number;
    lng: number;
  };
  budget: Budget;
  vibe: VibeOption;
  avoid?: readonly AvoidPreference[];
  selected?: readonly Candidate[];
  candidates: readonly Candidate[];
};

/**
 * V1 deterministic scoring weights.
 *
 * Weighted sum keeps the score explainable and bounded:
 * total = 0.30*quality + 0.30*fit + 0.25*styleVibe - 0.10*avoidPenalty - 0.05*diversityPenalty
 */
// Weights bias toward objective quality/fit while still allowing preference tuning signals.
const SCORING_WEIGHTS = {
  quality: 0.3,
  fit: 0.3,
  styleVibe: 0.25,
  avoidPenalty: 0.1,
  diversityPenalty: 0.05,
} as const;

const DISTANCE_FIT_CAP_M = 2_000;

const BUDGET_TARGET_LEVEL: Readonly<Record<Budget, number>> = {
  $: 1,
  $$: 2,
  $$$: 3,
};

const VIBE_SIGNALS: Readonly<Record<VibeOption, readonly string[]>> = {
  CHILL: ['COZY', 'NATURE', 'cafe', 'park', 'dessert_shop'],
  ROMANTIC: ['ROMANTIC', 'DATE_NIGHT', 'bar', 'restaurant', 'tourist_attraction'],
  CREATIVE: ['ARTSY', 'art_gallery', 'museum', 'workshop'],
  PLAYFUL: ['amusement_park', 'bowling_alley', 'arcade', 'mini_golf'],
  ACTIVE: ['NATURE', 'park', 'hiking_area', 'sports_complex'],
  LUXE: ['PREMIUM', 'fine_dining', 'spa', 'bar'],
};

const AVOID_TO_SIGNALS: Readonly<Record<AvoidPreference, readonly string[]>> = {
  OUTDOOR: ['NATURE', 'OUTDOOR', 'park', 'hiking_area', 'beach'],
  PHYSICAL: ['ACTIVE', 'PHYSICAL', 'gym', 'climbing_gym', 'hiking_area'],
  CROWDED: ['CROWDED', 'tourist_attraction', 'shopping_mall'],
  LOUD: ['LOUD', 'night_club', 'bar'],
};

const UBIQUITOUS_PLACE_TYPES = new Set<string>(['point_of_interest', 'establishment']);

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function normalizeSignals(values: readonly string[] | undefined): Set<string> {
  return new Set((values ?? []).map((value) => value.trim().toLowerCase()));
}

function normalizeDiversityTypes(values: readonly string[] | undefined): Set<string> {
  // Ignore high-frequency Google taxonomy buckets that would create false diversity penalties.
  return new Set(
    Array.from(normalizeSignals(values)).filter((type) => {
      return !UBIQUITOUS_PLACE_TYPES.has(type);
    }),
  );
}

function haversineDistanceMeters(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (value: number): number => (value * Math.PI) / 180;

  const latDistanceRad = toRadians(to.lat - from.lat);
  const lngDistanceRad = toRadians(to.lng - from.lng);
  const fromLatRad = toRadians(from.lat);
  const toLatRad = toRadians(to.lat);

  const a =
    Math.sin(latDistanceRad / 2) * Math.sin(latDistanceRad / 2) +
    Math.cos(fromLatRad) * Math.cos(toLatRad) * Math.sin(lngDistanceRad / 2) * Math.sin(lngDistanceRad / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(earthRadiusMeters * c);
}

@Injectable()
export class ScoringService {
  /**
   * Scores and ranks candidates deterministically so itinerary assembly remains stable.
   */
  scoreCandidates(input: ScoreCandidatesInput): ScoredCandidate[] {
    const seenTypeCounts = new Map<string, number>();
    const seenTagCounts = new Map<string, number>();

    for (const selected of input.selected ?? []) {
      for (const type of normalizeDiversityTypes(selected.types)) {
        seenTypeCounts.set(type, (seenTypeCounts.get(type) ?? 0) + 1);
      }

      for (const tag of normalizeSignals(selected.tags)) {
        seenTagCounts.set(tag, (seenTagCounts.get(tag) ?? 0) + 1);
      }
    }

    return [...input.candidates]
      .map((candidate) => {
        const distanceM = haversineDistanceMeters(input.origin, {
          lat: candidate.lat,
          lng: candidate.lng,
        });

        const qualityScore = this.computeQualityScore(candidate);
        const fitScore = this.computeFitScore(candidate, input.budget, distanceM);
        const styleVibeScore = this.computeVibeScore(candidate, input.vibe);
        const avoidPenalty = this.computeAvoidPenalty(candidate, input.avoid);
        const diversityPenalty = this.computeDiversityPenalty(candidate, seenTypeCounts, seenTagCounts);

        const score =
          SCORING_WEIGHTS.quality * qualityScore +
          SCORING_WEIGHTS.fit * fitScore +
          SCORING_WEIGHTS.styleVibe * styleVibeScore -
          SCORING_WEIGHTS.avoidPenalty * avoidPenalty -
          SCORING_WEIGHTS.diversityPenalty * diversityPenalty;

        return {
          candidate,
          distanceM,
          score,
          breakdown: {
            qualityScore,
            fitScore,
            styleVibeScore,
            avoidPenalty,
            diversityPenalty,
          },
        } satisfies ScoredCandidate;
      })
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        if (left.distanceM !== right.distanceM) {
          return left.distanceM - right.distanceM;
        }

        return left.candidate.externalId.localeCompare(right.candidate.externalId);
      });
  }

  private computeQualityScore(candidate: Candidate): number {
    const rating = candidate.rating ?? 3.5;
    const reviewCount = candidate.reviewCount ?? 0;

    const ratingScore = clamp01(rating / 5);
    const confidenceScore = clamp01(Math.log10(reviewCount + 1) / 3);

    return clamp01(0.7 * ratingScore + 0.3 * confidenceScore);
  }

  private computeFitScore(candidate: Candidate, budget: Budget, distanceM: number): number {
    const distanceScore = clamp01(1 - distanceM / DISTANCE_FIT_CAP_M);

    const targetPriceLevel = BUDGET_TARGET_LEVEL[budget];
    const budgetScore =
      candidate.priceLevel === undefined
        ? 0.6
        : clamp01(1 - Math.abs(candidate.priceLevel - targetPriceLevel) / 3);

    return clamp01(0.75 * distanceScore + 0.25 * budgetScore);
  }

  private computeVibeScore(candidate: Candidate, vibe: VibeOption): number {
    const signals = normalizeSignals([...(candidate.tags ?? []), ...(candidate.types ?? [])]);

    const vibeSignals = VIBE_SIGNALS[vibe].map((signal) => signal.toLowerCase());

    const vibeMatches = vibeSignals.filter((signal) => signals.has(signal)).length;
    const vibeScore = vibeSignals.length === 0 ? 0 : vibeMatches / vibeSignals.length;

    return clamp01(vibeScore);
  }

  private computeAvoidPenalty(candidate: Candidate, avoid: readonly AvoidPreference[] | undefined): number {
    if (!avoid || avoid.length === 0) {
      return 0;
    }

    const signals = normalizeSignals([...(candidate.tags ?? []), ...(candidate.types ?? [])]);
    let matchedAvoidRules = 0;

    for (const avoidRule of avoid) {
      const avoidSignals = AVOID_TO_SIGNALS[avoidRule].map((signal) => signal.toLowerCase());
      const hasMatch = avoidSignals.some((signal) => signals.has(signal));
      if (hasMatch) {
        matchedAvoidRules += 1;
      }
    }

    return clamp01(matchedAvoidRules / avoid.length);
  }

  private computeDiversityPenalty(
    candidate: Candidate,
    seenTypeCounts: ReadonlyMap<string, number>,
    seenTagCounts: ReadonlyMap<string, number>,
  ): number {
    const typeRepeats = Array.from(normalizeDiversityTypes(candidate.types)).map((type) => seenTypeCounts.get(type) ?? 0);
    const tagRepeats = Array.from(normalizeSignals(candidate.tags)).map((tag) => seenTagCounts.get(tag) ?? 0);

    const maxRepeatCount = Math.max(0, ...typeRepeats, ...tagRepeats);

    return clamp01(maxRepeatCount / 3);
  }
}
