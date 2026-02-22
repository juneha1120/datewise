import { test } from 'node:test';
import * as assert from 'assert/strict';
import { TaggingService } from './tagging.service';

const service = new TaggingService();

test('romantic keywords add DATE_NIGHT and ROMANTIC tags', () => {
  const tags = service.inferTags({
    types: ['restaurant'],
    snippets: ['Perfect date night spot with romantic sunset vibes.'],
  });

  assert.deepStrictEqual(tags, ['DATE_NIGHT', 'ROMANTIC']);
});

test('loud and crowded snippets add LOUD and CROWDED tags', () => {
  const tags = service.inferTags({
    types: ['night_club'],
    snippets: ['Very loud music and always packed with a long queue.'],
  });

  assert.deepStrictEqual(tags, ['CROWDED', 'LOUD']);
});

test('type-based tagging maps museum to ARTSY', () => {
  const tags = service.inferTags({
    types: ['museum'],
  });

  assert.deepStrictEqual(tags, ['ARTSY']);
});

test('price-level tagging adds budget hints deterministically', () => {
  const budgetTags = service.inferTags({ types: ['cafe'], priceLevel: 1 });
  const premiumTags = service.inferTags({ types: ['tourist_attraction'], priceLevel: 4 });

  assert.deepStrictEqual(budgetTags, ['BUDGET_FRIENDLY', 'COZY', 'DATE_NIGHT']);
  assert.deepStrictEqual(premiumTags, ['DATE_NIGHT', 'ICONIC', 'PREMIUM']);
});
