import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { avoidToSubgroups, openScoreFromState, radiusConfig, similarSuggestions } from './planner';

test('avoid logic core blocks all subgroups', () => {
  const blocked = avoidToSubgroups([{ type: 'CORE', core: 'SIP' }]);
  assert.equal(blocked.has('COFFEE'), true);
  assert.equal(blocked.has('SPIRIT'), true);
});

test('radius mode constraints', () => {
  assert.deepEqual(radiusConfig('WALKABLE'), { maxLegKm: 1, legMode: 'WALK' });
  assert.deepEqual(radiusConfig('SHORT_TRANSIT'), { maxLegKm: 5, legMode: 'TRANSIT' });
  assert.deepEqual(radiusConfig('CAR_GRAB'), { maxLegKm: 15, legMode: 'DRIVE' });
});

test('similar suggestions exclude avoided', () => {
  const suggestions = similarSuggestions('COFFEE', new Set(['DESSERT']));
  assert.deepEqual(suggestions, ['TEA_HOUSE', 'BUBBLE_TEA']);
});

test('open hours unknown is penalized, not rejected', () => {
  assert.equal(openScoreFromState('UNKNOWN'), 0.7);
  assert.equal(openScoreFromState('OPEN'), 1);
});
