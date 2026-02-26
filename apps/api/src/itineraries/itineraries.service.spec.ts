import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { Candidate, GenerateItineraryRequest } from '@datewise/shared';
import { PlacesService } from '../places/places.service';
import { ItineraryBuilder } from './itinerary-builder';
import { DirectionsService } from './directions.service';
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

function request(overrides: Partial<GenerateItineraryRequest> = {}): GenerateItineraryRequest {
  return {
    origin: {
      placeId: 'abc',
      name: 'User-provided name',
      formattedAddress: 'User-provided address',
      lat: 1.4,
      lng: 103.95,
      types: ['locality'],
    },
    date: '2026-03-10',
    startTime: '18:30',
    durationMin: 180,
    budget: '$$',
    vibe: 'ROMANTIC',
    ...overrides,
  };
}

test('generateItinerary returns places-only stops from nearby candidates', async () => {
  const mockedPlacesService = {
    details: async () => ({
      placeId: 'abc',
      name: 'Tanjong Pagar MRT',
      formattedAddress: '120 Maxwell Rd, Singapore 069119',
      lat: 1.2764,
      lng: 103.8458,
      types: ['train_station'],
    }),
    candidatesNearOrigin: async () => ({
      originPlaceId: 'abc',
      candidates: [candidate('food-1'), candidate('food-2'), candidate('food-3')],
    }),
    textSearchOptionsForVibe: () => ['romantic restaurant Singapore'],
  } as unknown as PlacesService;

  const mockedDirectionsService = {
    routeLeg: async () => ({
      mode: 'TRANSIT',
      durationMin: 10,
      distanceM: 1_000,
      walkingDistanceM: 400,
    }),
  } as unknown as DirectionsService;

  const service = new ItinerariesService(mockedPlacesService, new ItineraryBuilder(new ScoringService(), mockedDirectionsService));

  const itinerary = await service.generateItinerary(request());

  assert.equal(itinerary.stops.length, 3);
  assert.ok(itinerary.stops.every((stop) => stop.kind === 'PLACE'));
  assert.ok(itinerary.stops.every((stop) => stop.reason.length > 0));
});

test('generateItinerary uses canonical origin details from placeId for downstream builder', async () => {
  let capturedOriginLat = 0;
  const mockedPlacesService = {
    details: async () => ({
      placeId: 'abc',
      name: 'Canonical origin',
      formattedAddress: 'Canonical address',
      lat: 1.2764,
      lng: 103.8458,
      types: ['train_station'],
    }),
    candidatesNearOrigin: async () => ({
      originPlaceId: 'abc',
      candidates: [candidate('food-1'), candidate('food-2')],
    }),
    textSearchOptionsForVibe: () => ['romantic restaurant Singapore'],
  } as unknown as PlacesService;

  const mockedBuilder = {
    build: async (input: GenerateItineraryRequest) => {
      capturedOriginLat = input.origin.lat;
      return {
        itineraryId: 'iti_test',
        stops: [],
        legs: [],
        totals: { durationMin: input.durationMin, walkingDistanceM: 0 },
        meta: { usedCache: false, warnings: [], textSearchOptions: [] },
      };
    },
  } as unknown as ItineraryBuilder;

  const service = new ItinerariesService(mockedPlacesService, mockedBuilder);
  await service.generateItinerary(request());

  assert.equal(capturedOriginLat, 1.2764);
});
