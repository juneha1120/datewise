import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ItineraryBuilder } from './itinerary-builder';

test('ItineraryBuilder can be instantiated for DI wiring', () => {
  const builder = new ItineraryBuilder();
  assert.ok(builder instanceof ItineraryBuilder);
});
