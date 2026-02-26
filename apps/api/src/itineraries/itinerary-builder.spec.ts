import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { Candidate, GenerateItineraryRequest } from '@datewise/shared';
import { DirectionsService } from './directions.service';
import {
  determineStopCount,
  filterCandidatesWithinOriginRadius,
  hasOnlyNearbyLegs,
  ItineraryBuilder,
  pickAnchorCandidate,
} from './itinerary-builder';
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

function buildDirectionsService(totalWalkingDistanceM: number): DirectionsService {
  return {
    routeLeg: async (_from: { lat: number; lng: number }, _to: { lat: number; lng: number }) => ({
      mode: 'TRANSIT',
      durationMin: 10,
      distanceM: 1_000,
      walkingDistanceM: totalWalkingDistanceM,
    }),
  } as unknown as DirectionsService;
}

test('determineStopCount maps 2h/3h/4h windows to 2/3/4 stops', () => {
  assert.equal(determineStopCount(120, 8), 2);
  assert.equal(determineStopCount(180, 8), 3);
  assert.equal(determineStopCount(240, 8), 4);
  assert.equal(determineStopCount(240, 3), 3);
});

test('pickAnchorCandidate prefers vibe signals for ROMANTIC and ACTIVE', () => {
  const ranked = [
    {
      candidate: candidate('activity', { types: ['park'], tags: ['NATURE'] }),
      score: 0.95,
      distanceM: 500,
      breakdown: { qualityScore: 0.8, fitScore: 0.8, styleVibeScore: 0.6, avoidPenalty: 0, diversityPenalty: 0 },
    },
    {
      candidate: candidate('romantic', { types: ['restaurant'], tags: ['ROMANTIC', 'DATE_NIGHT'] }),
      score: 0.85,
      distanceM: 600,
      breakdown: { qualityScore: 0.8, fitScore: 0.8, styleVibeScore: 0.7, avoidPenalty: 0, diversityPenalty: 0 },
    },
  ] satisfies ScoredCandidate[];

  assert.equal(pickAnchorCandidate('ROMANTIC', ranked)?.candidate.externalId, 'romantic');
  assert.equal(pickAnchorCandidate('ACTIVE', ranked)?.candidate.externalId, 'activity');
});

test('nearby leg validation enforces 2km per-leg radius', () => {
  assert.equal(hasOnlyNearbyLegs([{ from: 0, to: 1, mode: 'TRANSIT', durationMin: 10, distanceM: 2_000 }]), true);
  assert.equal(hasOnlyNearbyLegs([{ from: 0, to: 1, mode: 'TRANSIT', durationMin: 10, distanceM: 2_001 }]), false);
});

test('origin radius filter removes candidates beyond 2km', () => {
  const ranked = [
    {
      candidate: candidate('near'),
      distanceM: 1_500,
      score: 0.8,
      breakdown: { qualityScore: 0.8, fitScore: 0.8, styleVibeScore: 0.8, avoidPenalty: 0, diversityPenalty: 0 },
    },
    {
      candidate: candidate('far'),
      distanceM: 10_500,
      score: 0.99,
      breakdown: { qualityScore: 0.9, fitScore: 0.9, styleVibeScore: 0.9, avoidPenalty: 0, diversityPenalty: 0 },
    },
  ] satisfies ScoredCandidate[];

  const filtered = filterCandidatesWithinOriginRadius(ranked);
  assert.deepEqual(filtered.map((item) => item.candidate.externalId), ['near']);
});

test('itinerary builder assembles routed legs, totals, and booking labels', async () => {
  const builder = new ItineraryBuilder(new ScoringService(), buildDirectionsService(300));

  const response = await builder.build(buildRequest({ durationMin: 240, vibe: 'ACTIVE' }), [
    candidate('active-1', { types: ['park'], tags: ['NATURE', 'ROMANTIC'], booking: { score: 42, label: 'CHECK_AVAILABILITY' } }),
    candidate('active-2', { types: ['tourist_attraction'], tags: ['ICONIC'] }),
    candidate('food-1', { types: ['restaurant'], tags: ['COZY'] }),
    candidate('activity-1', { types: ['museum'], tags: ['ARTSY'] }),
  ]);

  assert.equal(response.stops.length, 4);
  assert.ok(response.stops.every((stop) => stop.reason.length > 0));
  assert.equal(response.stops[0]?.booking?.label, 'CHECK_AVAILABILITY');
  assert.equal(response.totals.durationMin, 240);
  assert.ok(response.legs.length > 0);
  assert.ok(response.totals.walkingDistanceM > 0);
});

test('itinerary builder does not accept under-filled stop selection as route-valid', async () => {
  let routeCalls = 0;
  const directionsService = {
    routeLeg: async () => {
      routeCalls += 1;
      return {
        mode: 'TRANSIT',
        durationMin: 10,
        distanceM: 500,
        walkingDistanceM: 0,
      };
    },
  } as unknown as DirectionsService;

  const builder = new ItineraryBuilder(new ScoringService(), directionsService);
  const response = await builder.build(buildRequest({ durationMin: 180, dateStyle: 'FOOD' }), [
    candidate('anchor', {
      types: ['restaurant'],
      tags: ['DATE_NIGHT', 'COZY'],
      lat: 1.294,
      lng: 103.846,
    }),
    candidate('too-far-1', {
      types: ['restaurant'],
      tags: ['COZY'],
      lat: 1.2595,
      lng: 103.846,
    }),
    candidate('too-far-2', {
      types: ['restaurant'],
      tags: ['COZY'],
      lat: 1.2598,
      lng: 103.847,
    }),
  ]);

  assert.equal(routeCalls, 0);
  assert.equal(response.stops.length, 1);
  assert.ok(response.meta.warnings.some((warning) => warning.includes('within 2km')));
  assert.ok(response.meta.warnings.some((warning) => warning.includes('target stop count')));
});