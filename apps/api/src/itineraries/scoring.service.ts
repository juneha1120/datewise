import { Injectable } from '@nestjs/common';

type ScoreInput = {
  distanceM: number;
  maxLegKm: number;
  rating?: number;
  reviewCount?: number;
  priceLevel?: number;
  budgetLevel: 1 | 2 | 3;
  openScore: number;
  matchConfidence: number;
};

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

@Injectable()
export class ScoringService {
  scoreCandidate(input: ScoreInput): number {
    const maxDistanceM = Math.max(1, input.maxLegKm * 1000);
    const distanceScore = clamp(1 - input.distanceM / maxDistanceM);
    const qualityScore = clamp(
      ((input.rating ?? 3.8) / 5) * 0.7 + Math.min(1, Math.log10((input.reviewCount ?? 0) + 1) / 3) * 0.3,
    );
    const budgetFitScore =
      input.priceLevel === undefined ? 0.6 : clamp(1 - Math.abs(input.priceLevel - input.budgetLevel) / 3);

    return (
      0.3 * distanceScore +
      0.2 * qualityScore +
      0.15 * budgetFitScore +
      0.15 * input.openScore +
      0.2 * clamp(input.matchConfidence)
    );
  }
}
