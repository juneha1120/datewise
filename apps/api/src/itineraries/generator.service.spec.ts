import test from 'node:test';
import assert from 'node:assert/strict';
import { ScoringService } from './scoring.service';
import { GeneratorService } from './generator.service';

const places = {
  search: async (subgroup: string) => [
    { placeId: subgroup + '-1', name: `${subgroup} Prime`, subgroup, lat: 1, lng: 1, rating: 4.7, isOpen: true },
    { placeId: subgroup + '-2', name: `${subgroup} Far`, subgroup, lat: 1.1, lng: 1.1, rating: 4.0, isOpen: true },
  ],
  travelMinutes: (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => Math.round(Math.abs(from.lat - to.lat) * 200 + Math.abs(from.lng - to.lng) * 200),
};

test('assemble itinerary with travel legs', async () => {
  const service = new GeneratorService(places as never, new ScoringService());
  const result = await service.generate({
    start: { label: 'A', lat: 1.3, lng: 103.8 },
    date: '2026-01-01',
    time: '18:00',
    includeSlots: ['EAT', 'COFFEE'],
    avoidSlots: [],
  });
  assert.equal(result.length, 2);
  assert.equal(result[0].travelMinutes, 0);
});

test('rejects conflicts', async () => {
  const service = new GeneratorService(places as never, new ScoringService());
  await assert.rejects(() => service.generate({
    start: { label: 'A', lat: 1.3, lng: 103.8 },
    date: '2026-01-01',
    time: '18:00',
    includeSlots: ['EAT', 'COFFEE'],
    avoidSlots: ['EAT'],
  }));
});

test('regenerate slot returns alternate place', async () => {
  const service = new GeneratorService(places as never, new ScoringService());
  const updated = await service.regenerateSlot({
    start: { label: 'A', lat: 1.3, lng: 103.8 },
    date: '2026-01-01',
    time: '18:00',
    includeSlots: ['EAT', 'COFFEE'],
    avoidSlots: [],
    slotIndex: 1,
    existingPlaceNames: ['COFFEE Prime'],
  });
  assert.equal(updated.placeName.includes('Far'), true);
});
