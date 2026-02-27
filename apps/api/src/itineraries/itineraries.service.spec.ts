import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { GenerateItineraryRequest } from '@datewise/shared';
import { PlaceVerificationDetails, PlacesService, SlotSearchCandidate } from '../places/places.service';
import { DirectionsService } from './directions.service';
import { ItinerariesService } from './itineraries.service';
import { ScoringService } from './scoring.service';
import { avoidToSubgroups, isOpenAtDateTime, openScoreFromState, radiusConfig, similarSuggestions } from './planner';

function request(): GenerateItineraryRequest {
  return {
    origin: { placeId: 'origin', name: 'Origin', formattedAddress: 'Singapore', lat: 1.3, lng: 103.8, types: ['locality'] },
    date: '2026-03-10',
    startTime: '10:30',
    durationMin: 180,
    budgetLevel: 2,
    radiusMode: 'SHORT_TRANSIT',
    sequence: [{ type: 'SUBGROUP', subgroup: 'ESCAPE_ROOM' }, { type: 'CORE', core: 'EAT' }],
    avoid: [],
  };
}

test('avoid logic core blocks all subgroups', () => {
  const blocked = avoidToSubgroups([{ type: 'CORE', core: 'SIP' }]);
  assert.equal(blocked.has('COFFEE'), true);
  assert.equal(blocked.has('SPIRIT'), true);
});

test('radius mode constraints', () => {
  assert.deepEqual(radiusConfig('WALKABLE'), { maxLegKm: 1, legMode: 'WALK' });
  assert.deepEqual(radiusConfig('SHORT_TRANSIT'), { maxLegKm: 5, legMode: 'TRANSIT' });
  assert.deepEqual(radiusConfig('CAR_GRAB'), { maxLegKm: 15, legMode: 'DRIVE' });
});

test('similar suggestions exclude avoided', () => {
  const suggestions = similarSuggestions('COFFEE', new Set(['DESSERT']));
  assert.deepEqual(suggestions, ['TEA_HOUSE', 'BUBBLE_TEA']);
});

test('open hours unknown is penalized, not rejected', () => {
  assert.equal(openScoreFromState('UNKNOWN'), 0.7);
  assert.equal(openScoreFromState('OPEN'), 1);
});

test('future date open-hours evaluation uses weekly periods', () => {
  const state = isOpenAtDateTime(
    [
      {
        open: { day: 2, hour: 10, minute: 0 },
        close: { day: 2, hour: 22, minute: 0 },
      },
    ],
    '2026-03-10',
    '09:00',
  );

  assert.equal(state, 'CLOSED');
});

test('itinerary generation rejects non-relevant text-search candidates and mall eat collisions', async () => {
  const mockCandidates: Record<string, SlotSearchCandidate[]> = {
    ESCAPE_ROOM: [
      {
        kind: 'PLACE',
        externalId: 'bad-escape',
        name: 'Puzzle Cafe',
        lat: 1.3001,
        lng: 103.8001,
        types: ['cafe'],
      },
      {
        kind: 'PLACE',
        externalId: 'good-escape',
        name: 'Escape Room Operator',
        lat: 1.3002,
        lng: 103.8002,
        types: ['point_of_interest'],
      },
    ],
    JAPANESE: [
      {
        kind: 'PLACE',
        externalId: 'mall-collision',
        name: 'Mega Mall',
        lat: 1.3003,
        lng: 103.8003,
        types: ['restaurant', 'shopping_mall'],
      },
      {
        kind: 'PLACE',
        externalId: 'proper-restaurant',
        name: 'Sushi Place',
        lat: 1.3004,
        lng: 103.8004,
        types: ['restaurant'],
      },
    ],
  };

  const detailMap: Record<string, PlaceVerificationDetails> = {
    'bad-escape': { placeId: 'bad-escape', name: 'Puzzle Cafe', types: ['cafe'], regularOpeningPeriods: [{ open: { day: 2, hour: 8, minute: 0 }, close: { day: 2, hour: 23, minute: 0 } }] },
    'good-escape': { placeId: 'good-escape', name: 'Escape Room Operator', types: ['point_of_interest'], editorialSummary: 'Popular escape room in Singapore', regularOpeningPeriods: [{ open: { day: 2, hour: 10, minute: 0 }, close: { day: 2, hour: 23, minute: 0 } }] },
    'mall-collision': { placeId: 'mall-collision', name: 'Mega Mall', primaryType: 'shopping_mall', types: ['restaurant', 'shopping_mall'], regularOpeningPeriods: [{ open: { day: 2, hour: 10, minute: 0 }, close: { day: 2, hour: 23, minute: 0 } }] },
    'proper-restaurant': { placeId: 'proper-restaurant', name: 'Sushi Place', primaryType: 'restaurant', types: ['restaurant'], editorialSummary: 'Japanese sushi restaurant', regularOpeningPeriods: [{ open: { day: 2, hour: 10, minute: 0 }, close: { day: 2, hour: 23, minute: 0 } }] },
  };

  const placesService = {
    details: async () => ({ placeId: 'origin', name: 'Origin', formattedAddress: 'Singapore', lat: 1.3, lng: 103.8, types: ['locality'] }),
    searchForSubgroup: async (input: { subgroup: string }) => mockCandidates[input.subgroup] ?? [],
    placeVerificationDetails: async (placeId: string) => detailMap[placeId],
  } as unknown as PlacesService;

  const directions = {
    routeLeg: async () => ({ durationMin: 10, distanceM: 400, mode: 'WALK' as const, walkingDistanceM: 400 }),
  } as unknown as DirectionsService;

  const service = new ItinerariesService(placesService, directions, new ScoringService());
  const result = await service.generateItinerary(request());

  assert.equal(result.status, 'OK');
  if (result.status !== 'OK') return;

  assert.equal(result.stops[0].name, 'Escape Room Operator');
  assert.equal(result.stops[1].name, 'Sushi Place');
});
