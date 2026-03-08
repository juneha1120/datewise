import test from 'node:test';
import assert from 'node:assert/strict';
import { ScoringService } from './scoring.service';

test('scores nearby/high relevance higher', () => {
  const scoring = new ScoringService();
  const high = scoring.score({ relevance: 0.9, travelMinutes: 10, rating: 4.6 });
  const low = scoring.score({ relevance: 0.4, travelMinutes: 70, rating: 4.0 });
  assert.equal(high > low, true);
});
