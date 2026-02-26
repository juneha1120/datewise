import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { ItinerariesController } from './itineraries.controller';
import { ItinerariesService } from './itineraries.service';

function validBody() {
  return {
    origin: {
      placeId: 'abc',
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
  };
}

test('generate returns itinerary for valid payload', async () => {
  const service = {
    generateItinerary: async () => ({
      itineraryId: 'iti_test',
      stops: [
        {
          kind: 'PLACE',
          name: 'Place',
          lat: 1.3,
          lng: 103.8,
          address: 'Singapore',
          url: 'https://example.com',
          rating: 4.4,
          reviewCount: 100,
          priceLevel: 2,
          tags: ['COZY'],
          reason: 'Strong style match',
        },
      ],
      legs: [],
      totals: {
        durationMin: 180,
        walkingDistanceM: 0,
      },
      meta: {
        usedCache: false,
        warnings: [],
      },
    }),
  } as unknown as ItinerariesService;

  const controller = new ItinerariesController(service);
  const response = await controller.generate(validBody());

  assert.equal(response.itineraryId, 'iti_test');
  assert.equal(response.stops.length, 1);
});

test('generate throws BadRequestException with mapped errors for invalid payload', async () => {
  const service = {
    generateItinerary: async () => {
      throw new Error('should not be called');
    },
  } as unknown as ItinerariesService;
  const controller = new ItinerariesController(service);

  await assert.rejects(
    async () => controller.generate({ date: '2026/01/01' }),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      if (!(error instanceof BadRequestException)) {
        return false;
      }

      const response = error.getResponse() as {
        message: string;
        errors: Array<{ path: string; message: string }>;
      };

      assert.equal(response.message, 'Validation failed');
      assert.ok(response.errors.some((issue) => issue.path === 'origin'));
      return true;
    },
  );
});
