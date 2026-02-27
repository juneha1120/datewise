import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { DirectionsService } from './directions.service';

test('routeLeg maps walking mode for walkable radius', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ status: 'OK', routes: [{ legs: [{ distance: { value: 900 }, duration: { value: 600 }, steps: [{ travel_mode: 'WALKING', distance: { value: 900 } }] }] }] }) }) as Response;

  try {
    const service = new DirectionsService();
    const leg = await service.routeLeg({ lat: 1.3, lng: 103.8 }, { lat: 1.31, lng: 103.82 }, 'WALKABLE');
    assert.equal(leg.mode, 'WALK');
    assert.equal(leg.distanceM, 900);
    assert.equal(leg.walkingDistanceM, 900);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('routeLeg falls back to estimated leg when Google returns invalid response shape', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ malformed: true }) }) as Response;

  try {
    const service = new DirectionsService();
    const leg = await service.routeLeg({ lat: 1.3, lng: 103.8 }, { lat: 1.31, lng: 103.82 }, 'SHORT_TRANSIT');
    assert.equal(leg.mode, 'TRANSIT');
    assert.equal(leg.durationMin > 0, true);
    assert.equal(leg.distanceM > 0, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
