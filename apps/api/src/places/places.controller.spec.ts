import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { PlacesController } from './places.controller';
import { PlacesService } from './places.service';

test('autocomplete throws BadRequestException for invalid query params', async () => {
  const placesService = {
    autocomplete: async () => ({ suggestions: [] }),
    details: async () => ({
      placeId: 'mbx.sg.1',
      name: 'Name',
      formattedAddress: 'Address',
      lat: 1.1,
      lng: 103.1,
      types: ['poi'],
    }),
  };
  const controller = new PlacesController(placesService as unknown as PlacesService);

  await assert.rejects(async () => controller.autocomplete(''), (error: unknown) => {
    assert.ok(error instanceof BadRequestException);
    const response = error.getResponse() as Record<string, unknown>;
    assert.equal(response.code, 'INVALID_PLACES_AUTOCOMPLETE_QUERY');
    return true;
  });
});

test('details throws BadRequestException for invalid query params', async () => {
  const placesService = {
    autocomplete: async () => ({ suggestions: [] }),
    details: async () => ({
      placeId: 'mbx.sg.1',
      name: 'Name',
      formattedAddress: 'Address',
      lat: 1.1,
      lng: 103.1,
      types: ['poi'],
    }),
  };
  const controller = new PlacesController(placesService as unknown as PlacesService);

  await assert.rejects(async () => controller.details(''), (error: unknown) => {
    assert.ok(error instanceof BadRequestException);
    const response = error.getResponse() as Record<string, unknown>;
    assert.equal(response.code, 'INVALID_PLACE_DETAILS_QUERY');
    return true;
  });
});
