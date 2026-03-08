import test from 'node:test';
import assert from 'node:assert/strict';
import { detectConflict, generateItinerarySchema, resolveCore } from './index';

test('detects subgroup conflict', () => {
  assert.deepEqual(detectConflict(['JAPANESE'], ['EAT']), ['includeSlots[0] conflicts with avoid slots']);
});

test('resolves core from subgroup', () => {
  assert.equal(resolveCore('MUSEUM'), 'DO');
});

test('rejects conflict through schema', () => {
  assert.throws(() =>
    generateItinerarySchema.parse({
      start: { label: 'A', lat: 1.2, lng: 103.2 },
      date: '2026-01-01',
      time: '18:00',
      includeSlots: ['EAT', 'COFFEE'],
      avoidSlots: ['EAT'],
    }),
  );
});
