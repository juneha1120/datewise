import test from 'node:test';
import assert from 'node:assert/strict';
import { GeneratorService } from './generator.service';

const places = {
  search: async (subgroup: string) => [{ placeId: subgroup + '-1', name: 'A', subgroup, lat: 1, lng: 1, rating: 4.2, isOpen: true }],
  travelMinutes: () => 12,
};

test('assemble itinerary with travel legs', async () => {
  const service = new GeneratorService(places as never);
  const result = await service.generate({
    start: { label: 'A', lat: 1.3, lng: 103.8 },
    date: '2026-01-01',
    time: '18:00',
    includeSlots: ['EAT', 'COFFEE'],
    avoidSlots: [],
  });
  assert.equal(result.length, 2);
  assert.equal(result[1].travelMinutes, 12);
});

test('rejects conflicts', async () => {
  const service = new GeneratorService(places as never);
  await assert.rejects(() => service.generate({
    start: { label: 'A', lat: 1.3, lng: 103.8 }, date: '2026-01-01', time: '18:00', includeSlots: ['EAT', 'COFFEE'], avoidSlots: ['EAT'],
  }));
});
