import test from 'node:test';
import assert from 'node:assert/strict';
import { detectConflict, resolveCore } from './index';

test('detects subgroup conflict', () => {
  assert.deepEqual(detectConflict(['JAPANESE'], ['EAT']), ['includeSlots[0] conflicts with avoid slots']);
});

test('resolves core from subgroup', () => {
  assert.equal(resolveCore('MUSEUM'), 'DO');
});
