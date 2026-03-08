import test from 'node:test';
import assert from 'node:assert/strict';
import { TaggingService } from './tagging.service';

test('tagging heuristic detects keyword relevance', () => {
  const tagging = new TaggingService();
  const sushi = tagging.relevanceScore('JAPANESE', 'Best Sushi Izakaya');
  const random = tagging.relevanceScore('JAPANESE', 'Central Flower Store');
  assert.equal(sushi > random, true);
});
