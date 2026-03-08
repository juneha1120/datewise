import { Injectable } from '@nestjs/common';

@Injectable()
export class ScoringService {
  score(input: { relevance: number; travelMinutes: number; rating: number }): number {
    const distancePenalty = Math.min(1, input.travelMinutes / 120);
    const normalizedRating = Math.max(0, Math.min(1, (input.rating - 3.5) / 1.5));
    return input.relevance * 0.55 + (1 - distancePenalty) * 0.3 + normalizedRating * 0.15;
  }
}
