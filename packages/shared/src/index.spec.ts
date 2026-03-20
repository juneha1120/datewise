import test from 'node:test';
import assert from 'node:assert/strict';
import { detectConflict, generateItinerarySchema, resolveCore } from './index';

test('detects subgroup conflict', () => {
  assert.deepEqual(detectConflict(['JAPANESE'], ['EAT']), ['slots[0] conflicts with avoidSlots']);
});

test('resolves core from subgroup', () => {
  assert.equal(resolveCore('MUSEUM'), 'DO');
});

test('rejects conflict through schema', () => {
  assert.throws(() =>
    generateItinerarySchema.parse({
      startPoint: { name: 'A', latitude: 1.2, longitude: 103.2, placeId: 'p1' },
      date: '2026-01-01',
      time: '18:00',
      slots: ['EAT', 'COFFEE'],
      avoidSlots: ['EAT'],
    }),
  );
});
