declare const test: (name: string, fn: () => void | Promise<void>) => void;
import * as assert from 'assert/strict';
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
     if (!(error instanceof BadRequestException)) {
      return false;
    }

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
    if (!(error instanceof BadRequestException)) {
      return false;
    }

    const response = error.getResponse() as Record<string, unknown>;
    assert.equal(response.code, 'INVALID_PLACE_DETAILS_QUERY');
    return true;
  });
});
