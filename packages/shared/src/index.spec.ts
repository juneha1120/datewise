import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { GenerateItineraryRequestSchema, PlaceDetailsResponseSchema, PlacesAutocompleteQuerySchema } from './index';

test('PlacesAutocompleteQuerySchema table-driven validation', () => {
  const valid = [{ q: 'marina bay' }, { q: 'sg' }];
  const invalid: Array<Record<string, unknown>> = [{ q: '' }, { q: 'a' }, { q: 'x'.repeat(121) }, {}];

  for (const payload of valid) {
    assert.equal(PlacesAutocompleteQuerySchema.safeParse(payload).success, true);
  }

  for (const payload of invalid) {
    assert.equal(PlacesAutocompleteQuerySchema.safeParse(payload).success, false);
  }
});

test('PlaceDetailsResponseSchema table-driven validation', () => {
  const valid = [
    {
      placeId: 'sg.1',
      name: 'Merlion Park',
      formattedAddress: '1 Fullerton Rd, Singapore',
      lat: 1.2868,
      lng: 103.8545,
      types: ['tourist_attraction'],
    },
  ];
  const invalid = [
    { placeId: '', name: 'X', formattedAddress: 'Y', lat: 1, lng: 2, types: [] },
    { placeId: 'a', name: '', formattedAddress: 'Y', lat: 1, lng: 2, types: [] },
    { placeId: 'a', name: 'X', formattedAddress: 'Y', lat: '1', lng: 2, types: [] },
  ];

  for (const payload of valid) {
    assert.equal(PlaceDetailsResponseSchema.safeParse(payload).success, true);
  }

  for (const payload of invalid) {
    assert.equal(PlaceDetailsResponseSchema.safeParse(payload).success, false);
  }
});

test('GenerateItineraryRequestSchema table-driven validation', () => {
  const basePayload = {
    origin: {
      placeId: 'sg.origin',
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
  };

  const valid = [basePayload];
  const invalid = [
    { ...basePayload, date: '2026/03/10' },
    { ...basePayload, startTime: '25:30' },
  ];

  for (const payload of valid) {
    assert.equal(GenerateItineraryRequestSchema.safeParse(payload).success, true);
  }

  for (const payload of invalid) {
    assert.equal(GenerateItineraryRequestSchema.safeParse(payload).success, false);
  }
});
