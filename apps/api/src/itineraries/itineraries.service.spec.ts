declare const test: (name: string, fn: () => void | Promise<void>) => void;
import * as assert from 'assert/strict';
import { ItinerariesService } from './itineraries.service';

test('generateStubItinerary includes requested selection tags in stub response', () => {
  const service = new ItinerariesService();

  const itinerary = service.generateStubItinerary({
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
    dateStyle: 'FOOD',
    vibe: 'ROMANTIC',
    food: ['VEG', 'NO_ALCOHOL'],
    avoid: ['LOUD'],
    transport: undefined,
  });

  const stopTags = itinerary.stops.flatMap((stop) => stop.tags);
  assert.ok(stopTags.includes('FOOD'));
  assert.ok(stopTags.includes('ROMANTIC'));
  assert.ok(stopTags.includes('FOOD_VEG'));
  assert.ok(stopTags.includes('FOOD_NO_ALCOHOL'));
  assert.ok(stopTags.includes('AVOID_LOUD'));
});
