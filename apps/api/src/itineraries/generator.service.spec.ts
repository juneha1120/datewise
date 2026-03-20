import test from 'node:test';
import assert from 'node:assert/strict';
import type { GenerateItineraryInput } from '@datewise/shared';
import { ScoringService } from './scoring.service';
import { GeneratorService } from './generator.service';
import { db } from '../db';

const places = {
  search: async (subgroup: string) => [
    { placeId: subgroup + '-1', name: `${subgroup} Prime`, subgroup, lat: 1.3, lng: 103.8, rating: 4.7, isOpen: true, address: 'Singapore' },
    { placeId: subgroup + '-2', name: `${subgroup} Far`, subgroup, lat: 1.36, lng: 103.86, rating: 4.0, isOpen: true, address: 'Singapore' },
  ],
  travelMinutes: (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => Math.round(Math.abs(from.lat - to.lat) * 200 + Math.abs(from.lng - to.lng) * 200),
};

test('assemble itinerary with travel legs and timestamps', async () => {
  const service = new GeneratorService(places as never, new ScoringService());
  const result = await service.generate({
    startPoint: { name: 'A', latitude: 1.3, longitude: 103.8, placeId: 'p1' },
    date: '2026-01-01',
    time: '18:00',
    slots: ['EAT', 'COFFEE'],
    avoidSlots: [],
  });
  assert.equal(result.length, 2);
  assert.equal(result[0].travelMinutes, 0);
  assert.equal(Boolean(result[0].arrivalTime), true);
  assert.equal(Boolean(result[0].departureTime), true);
  assert.equal(Boolean(result[0].place.placeId), true);
  assert.equal(result[0].slotType, 'EAT');
});

test('rejects conflicts', async () => {
  const service = new GeneratorService(places as never, new ScoringService());
  await assert.rejects(() =>
    service.generate({
      startPoint: { name: 'A', latitude: 1.3, longitude: 103.8, placeId: 'p1' },
      date: '2026-01-01',
      time: '18:00',
      slots: ['EAT', 'COFFEE'],
      avoidSlots: ['EAT'],
    }),
  );
});

test('regenerate slot returns alternate place', async () => {
  const service = new GeneratorService(places as never, new ScoringService());
  const updated = await service.regenerateSlot({
    startPoint: { name: 'A', latitude: 1.3, longitude: 103.8, placeId: 'p1' },
    date: '2026-01-01',
    time: '18:00',
    slots: ['EAT', 'COFFEE'],
    avoidSlots: [],
    slotIndex: 1,
    existingPlaceIds: ['COFFEE-1'],
  });
  assert.equal(updated.place.name.includes('Far'), true);
  assert.equal(Boolean(updated.place.placeId), true);
});

test('saveGenerated validates payload and stores server-normalized result', async () => {
  const service = new GeneratorService(places as never, new ScoringService());
  db.itineraries.clear();

  const input: GenerateItineraryInput = {
    startPoint: { name: 'A', latitude: 1.3, longitude: 103.8, placeId: 'p1' },
    date: '2026-01-01',
    time: '18:00',
    slots: ['EAT', 'COFFEE'],
    avoidSlots: [],
  };

  const saved = await service.saveGenerated(
    'user-1',
    input,
    [
      {
        slotIndex: 0,
        slotType: 'EAT',
        subgroup: 'HAWKER',
        travelMinutes: 999,
        arrivalTime: 'invalid',
        departureTime: 'invalid',
        place: {
          name: 'Stale Place',
          placeId: 'stale',
          latitude: 0,
          longitude: 0,
          address: 'Nowhere',
          rating: 1,
        },
      },
    ],
    true,
  );

  assert.equal(saved.input.startPoint.placeId, 'p1');
  assert.equal(saved.result.length, 2);
  assert.equal(saved.result[0].travelMinutes, 0);
  assert.notEqual(saved.result[0].place.placeId, 'stale');
  assert.equal(saved.isPublic, true);
});

test('saveGenerated rejects malformed client result payloads', async () => {
  const service = new GeneratorService(places as never, new ScoringService());
  await assert.rejects(() =>
    service.saveGenerated(
      'user-1',
      {
        startPoint: { name: 'A', latitude: 1.3, longitude: 103.8, placeId: 'p1' },
        date: '2026-01-01',
        time: '18:00',
        slots: ['EAT', 'COFFEE'],
        avoidSlots: [],
      },
      [{ slotIndex: 0, slotType: 'EAT' } as never],
      false,
    ),
  );
});
