import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { Candidate } from '@datewise/shared';
import { PlacesService } from '../places/places.service';
import { ItineraryBuilder } from './itinerary-builder';
import { ScoringService } from './scoring.service';
import { ItinerariesService } from './itineraries.service';

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
    types: ['restaurant'],
    tags: ['COZY', 'DATE_NIGHT'],
    ...overrides,
  };
}

test('generateItinerary returns places-only stops from nearby candidates', async () => {
  const mockedPlacesService = {
    candidatesNearOrigin: async () => ({
      originPlaceId: 'abc',
      candidates: [candidate('food-1'), candidate('food-2'), candidate('food-3')],
    }),
  } as unknown as PlacesService;

  const service = new ItinerariesService(mockedPlacesService, new ItineraryBuilder(new ScoringService()));

  const itinerary = await service.generateItinerary({
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
  });

  assert.equal(itinerary.stops.length, 3);
  assert.ok(itinerary.stops.every((stop) => stop.kind === 'PLACE'));
  assert.ok(itinerary.stops.every((stop) => stop.reason.length > 0));
});
