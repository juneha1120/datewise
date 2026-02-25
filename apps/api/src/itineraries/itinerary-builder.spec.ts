import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { Candidate, GenerateItineraryRequest } from '@datewise/shared';
import { determineStopCount, ItineraryBuilder, pickAnchorCandidate } from './itinerary-builder';
import { ScoredCandidate, ScoringService } from './scoring.service';

function buildRequest(overrides: Partial<GenerateItineraryRequest> = {}): GenerateItineraryRequest {
  return {
    origin: {
      placeId: 'origin-place',
      name: 'Tanjong Pagar MRT',
      formattedAddress: '120 Maxwell Rd, Singapore 069119',
      lat: 1.2764,
      lng: 103.8458,
      types: ['train_station'],
    },
    date: '2026-03-10',
    startTime: '18:30',
    durationMin: 180,
    budget: '$$',
    dateStyle: 'FOOD',
    vibe: 'ROMANTIC',
    ...overrides,
  };
}

function candidate(externalId: string, overrides: Partial<Candidate> = {}): Candidate {
  return {
    kind: 'PLACE',
    externalId,
    name: externalId,
    lat: 1.29,
    lng: 103.85,
    address: 'Singapore',
    rating: 4.5,
    reviewCount: 300,
    priceLevel: 2,
    types: ['tourist_attraction'],
    tags: ['ICONIC'],
    ...overrides,
  };
}

test('determineStopCount maps 2h/3h/4h windows to 2/3/4 stops', () => {
  assert.equal(determineStopCount(120, 8), 2);
  assert.equal(determineStopCount(180, 8), 3);
  assert.equal(determineStopCount(240, 8), 4);
  assert.equal(determineStopCount(240, 3), 3);
});

test('pickAnchorCandidate prefers dateStyle signals for FOOD and SCENIC', () => {
  const ranked = [
    {
      candidate: candidate('activity', { types: ['museum'], tags: ['ARTSY'] }),
      score: 0.95,
      distanceM: 500,
      breakdown: { qualityScore: 0.8, fitScore: 0.8, styleVibeScore: 0.6, avoidPenalty: 0, diversityPenalty: 0 },
    },
    {
      candidate: candidate('food', { types: ['restaurant'], tags: ['COZY', 'DATE_NIGHT'] }),
      score: 0.85,
      distanceM: 600,
      breakdown: { qualityScore: 0.8, fitScore: 0.8, styleVibeScore: 0.7, avoidPenalty: 0, diversityPenalty: 0 },
    },
    {
      candidate: candidate('scenic', { types: ['park'], tags: ['NATURE', 'ROMANTIC'] }),
      score: 0.8,
      distanceM: 700,
      breakdown: { qualityScore: 0.8, fitScore: 0.8, styleVibeScore: 0.7, avoidPenalty: 0, diversityPenalty: 0 },
    },
  ] satisfies ScoredCandidate[];

  assert.equal(pickAnchorCandidate('FOOD', ranked)?.candidate.externalId, 'food');
  assert.equal(pickAnchorCandidate('SCENIC', ranked)?.candidate.externalId, 'scenic');
});

test('itinerary builder assembles stops with reason text and totals', () => {
  const builder = new ItineraryBuilder(new ScoringService());

  const response = builder.build(buildRequest({ durationMin: 240, dateStyle: 'SCENIC' }), [
    candidate('scenic-1', { types: ['park'], tags: ['NATURE', 'ROMANTIC'] }),
    candidate('scenic-2', { types: ['tourist_attraction'], tags: ['ICONIC'] }),
    candidate('food-1', { types: ['restaurant'], tags: ['COZY'] }),
    candidate('activity-1', { types: ['museum'], tags: ['ARTSY'] }),
  ]);

  assert.equal(response.stops.length, 4);
  assert.ok(response.stops.every((stop) => stop.reason.length > 0));
  assert.equal(response.totals.durationMin, 240);
  assert.ok(response.legs.length > 0);
});
