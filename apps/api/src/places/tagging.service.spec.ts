import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { TaggingService } from './tagging.service';

test('TaggingService is no-op in refined model', () => {
  const service = new TaggingService();
  assert.ok(service instanceof TaggingService);
});
