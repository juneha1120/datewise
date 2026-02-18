declare const test: (name: string, fn: () => void | Promise<void>) => void;
import * as assert from 'assert/strict';
import { HttpException, HttpStatus } from '@nestjs/common';
import { mapboxAutocompleteToResponse, mapboxDetailsToResponse } from './places.service';

test('mapboxAutocompleteToResponse normalizes suggestions and enforces SG filtering', () => {
  const response = mapboxAutocompleteToResponse({
    features: [
      {
        properties: {
          mapbox_id: 'mbx.sg.1',
          name: 'Marina Bay Sands',
          full_address: '10 Bayfront Ave, Singapore',
          context: {
            country: {
              country_code: 'SG',
            },
          },
        },
      },
      {
        properties: {
          mapbox_id: 'mbx.us.1',
          name: 'Not In Singapore',
          full_address: 'Somewhere else',
          context: {
            country: {
              country_code: 'US',
            },
          },
        },
      },
    ],
  });

  assert.deepStrictEqual(response, {
    suggestions: [
      {
        placeId: 'mbx.sg.1',
        primaryText: 'Marina Bay Sands',
        secondaryText: '10 Bayfront Ave, Singapore',
      },
    ],
  });
});

test('mapboxDetailsToResponse normalizes place details payload', () => {
  const response = mapboxDetailsToResponse({
    features: [
      {
        properties: {
          mapbox_id: 'mbx.sg.2',
          name: 'Clarke Quay MRT',
          full_address: '2 Eu Tong Sen St, Singapore',
          feature_type: 'poi',
          context: {
            country: {
              country_code: 'sg',
            },
          },
        },
        geometry: {
          coordinates: [103.8463, 1.2881],
        },
      },
    ],
  });

  assert.deepStrictEqual(response, {
    placeId: 'mbx.sg.2',
    name: 'Clarke Quay MRT',
    formattedAddress: '2 Eu Tong Sen St, Singapore',
    lat: 1.2881,
    lng: 103.8463,
    types: ['poi'],
  });
});

test('mapboxAutocompleteToResponse filters features without SG country metadata', () => {
  const response = mapboxAutocompleteToResponse({
    features: [
      {
        properties: {
          mapbox_id: 'mbx.unknown.1',
          name: 'Unknown Country Feature',
          full_address: 'Unknown address',
        },
      },
    ],
  });

  assert.deepStrictEqual(response, { suggestions: [] });
});

test('mapboxAutocompleteToResponse maps normalization errors to BAD_GATEWAY HttpException', () => {
  assert.throws(
    () =>
      mapboxAutocompleteToResponse({
        features: [
          {
            properties: {
              mapbox_id: 'mbx.sg.3',
              context: {
                country: {
                  country_code: 'SG',
                },
              },
            },
          },
        ],
      }),
    (error: unknown) => {
      assert.ok(error instanceof HttpException);
      if (!(error instanceof HttpException)) {
        return false;
      }

      assert.equal(error.getStatus(), HttpStatus.BAD_GATEWAY);
      const response = error.getResponse() as Record<string, unknown>;
      assert.equal(response.code, 'INVALID_EXTERNAL_RESPONSE');
      return true;
    },
  );
});
