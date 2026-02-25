import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  GenerateItineraryRequestSchema,
  PlacesAutocompleteQuerySchema,
  PlaceDetailsResponseSchema,
} from '@datewise/shared';

test('shared schemas accept valid autocomplete query', () => {
  const parsed = PlacesAutocompleteQuerySchema.safeParse({ q: 'marina bay' });
  assert.equal(parsed.success, true);
});

test('shared schemas reject invalid itinerary payload', () => {
  const parsed = GenerateItineraryRequestSchema.safeParse({
    origin: { placeId: '', name: 'X', formattedAddress: 'Y', lat: 1, lng: 103, types: [] },
    date: '2026/01/01',
    startTime: '18:30',
    durationMin: 180,
    budget: '$$',
    dateStyle: 'FOOD',
    vibe: 'ROMANTIC',
  });

  assert.equal(parsed.success, false);
});

test('shared schemas reject invalid place details payload', () => {
  const parsed = PlaceDetailsResponseSchema.safeParse({
    placeId: 'abc',
    name: '',
    formattedAddress: 'Singapore',
    lat: 1.2,
  });

  assert.equal(parsed.success, false);
});
