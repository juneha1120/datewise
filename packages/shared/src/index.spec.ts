import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { GenerateItineraryRequestSchema, GenerateItineraryResultSchema } from './index';

test('GenerateItineraryRequestSchema validates refined payload', () => {
  const payload = {
    origin: { placeId: 'abc', name: 'Origin', formattedAddress: 'SG', lat: 1.3, lng: 103.8, types: ['locality'] },
    date: '2026-03-10',
    startTime: '18:30',
    budgetLevel: 2,
    radiusMode: 'SHORT_TRANSIT',
    sequence: [{ type: 'CORE', core: 'EAT' }, { type: 'SUBGROUP', subgroup: 'COFFEE' }],
    avoid: [{ type: 'CORE', core: 'DO' }],
  };

  assert.equal(GenerateItineraryRequestSchema.safeParse(payload).success, true);
});

test('GenerateItineraryResultSchema accepts conflict response', () => {
  const conflict = {
    status: 'CONFLICT',
    reason: 'NO_CANDIDATES_WITHIN_RADIUS',
    message: 'No candidates.',
    suggestions: [{ type: 'UPGRADE_RADIUS_MODE', message: 'Try wider.', recommendedRadiusMode: 'CAR_GRAB' }],
  };

  assert.equal(GenerateItineraryResultSchema.safeParse(conflict).success, true);
});
