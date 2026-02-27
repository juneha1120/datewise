import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { ItinerariesController } from './itineraries.controller';
import { ItinerariesService } from './itineraries.service';

function validBody() {
  return {
    origin: { placeId: 'abc', name: 'Origin', formattedAddress: 'Singapore', lat: 1.3, lng: 103.8, types: ['locality'] },
    date: '2026-03-10',
    startTime: '18:30',
    budgetLevel: 2,
    radiusMode: 'SHORT_TRANSIT',
    sequence: [{ type: 'CORE', core: 'EAT' }, { type: 'SUBGROUP', subgroup: 'COFFEE' }],
    avoid: [],
  };
}

test('generate returns itinerary for valid payload', async () => {
  const service = {
    generateItinerary: async () => ({ status: 'OK', itineraryId: 'iti_test', stops: [], legs: [], totals: { durationMin: 180, durationLabel: '3 hours', walkingDistanceM: 0 }, meta: { usedCache: false, warnings: [] } }),
  } as unknown as ItinerariesService;

  const controller = new ItinerariesController(service);
  const response = await controller.generate(validBody());

  assert.equal(response.status, 'OK');
});

test('generate throws BadRequestException with mapped errors for invalid payload', async () => {
  const service = { generateItinerary: async () => ({ status: 'CONFLICT', reason: 'NO_CANDIDATES_WITHIN_RADIUS', message: 'x', suggestions: [] }) } as unknown as ItinerariesService;
  const controller = new ItinerariesController(service);

  await assert.rejects(
    async () => controller.generate({ date: '2026/01/01' }),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      return true;
    },
  );
});

test('replace-stop returns itinerary response for valid payload', async () => {
  const service = {
    replaceStopWithTextSearch: async (input: { itinerary: { itineraryId: string } }) => ({
      status: 'OK',
      itineraryId: input.itinerary.itineraryId,
      stops: [],
      legs: [],
      totals: { durationMin: 180, durationLabel: '3 hours', walkingDistanceM: 0 },
      meta: { usedCache: false, warnings: ['deprecated'] },
    }),
  } as unknown as ItinerariesService;

  const controller = new ItinerariesController(service);
  const response = await controller.replaceStopWithTextSearch({
    originPlaceId: 'origin',
    stopIndex: 0,
    query: 'coffee',
    itinerary: { status: 'OK', itineraryId: 'iti_test', stops: [], legs: [], totals: { durationMin: 180, durationLabel: '3 hours', walkingDistanceM: 0 }, meta: { usedCache: false, warnings: [] } },
  });

  assert.equal(response.status, 'OK');
  assert.equal(response.itineraryId, 'iti_test');
});

test('replace-stop throws BadRequestException with mapped errors for invalid payload', async () => {
  const service = { replaceStopWithTextSearch: async () => ({ status: 'OK', itineraryId: 'x', stops: [], legs: [], totals: { durationMin: 60, durationLabel: '1 hour', walkingDistanceM: 0 }, meta: { usedCache: false, warnings: [] } }) } as unknown as ItinerariesService;
  const controller = new ItinerariesController(service);

  await assert.rejects(
    async () => controller.replaceStopWithTextSearch({ stopIndex: -1 }),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      return true;
    },
  );
});