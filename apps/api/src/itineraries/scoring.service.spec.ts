import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ScoringService } from './scoring.service';

test('scoreCandidate favors closer and better matched candidates', () => {
  const service = new ScoringService();

  const strong = service.scoreCandidate({
    distanceM: 300,
    maxLegKm: 5,
    rating: 4.6,
    reviewCount: 1200,
    priceLevel: 2,
    budgetLevel: 2,
    openScore: 1,
    matchConfidence: 0.9,
  });

  const weak = service.scoreCandidate({
    distanceM: 4500,
    maxLegKm: 5,
    rating: 3.8,
    reviewCount: 20,
    priceLevel: 4,
    budgetLevel: 1,
    openScore: 0.7,
    matchConfidence: 0.6,
  });

  assert.equal(strong > weak, true);
});
