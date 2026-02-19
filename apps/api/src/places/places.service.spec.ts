declare const test: (name: string, fn: () => void | Promise<void>) => void;
import * as assert from 'assert/strict';
import { HttpException, HttpStatus } from '@nestjs/common';
import { PlacesService, googleAutocompleteToResponse, googleDetailsToResponse } from './places.service';

test('googleAutocompleteToResponse normalizes suggestions', () => {
  const response = googleAutocompleteToResponse({
    suggestions: [
      {
        placePrediction: {
          placeId: 'g.sg.1',
          structuredFormat: {
            mainText: { text: 'Marina Bay Sands' },
            secondaryText: { text: 'Singapore' },
          },
        },
      },
    ],
  });

  assert.deepStrictEqual(response, {
    suggestions: [
      {
        placeId: 'g.sg.1',
        primaryText: 'Marina Bay Sands',
        secondaryText: 'Singapore',
      },
    ],
  });
});

test('googleDetailsToResponse normalizes place details payload', () => {
  const response = googleDetailsToResponse({
    id: 'g.sg.2',
    displayName: { text: 'Clarke Quay MRT' },
    formattedAddress: '2 Eu Tong Sen St, Singapore',
    location: {
      latitude: 1.2881,
      longitude: 103.8463,
    },
    types: ['train_station'],
    addressComponents: [
      {
        shortText: 'SG',
        types: ['country', 'political'],
      },
    ],
  });

  assert.deepStrictEqual(response, {
    placeId: 'g.sg.2',
    name: 'Clarke Quay MRT',
    formattedAddress: '2 Eu Tong Sen St, Singapore',
    lat: 1.2881,
    lng: 103.8463,
    types: ['train_station'],
  });
});

test('googleDetailsToResponse rejects non-Singapore results', () => {
  assert.throws(
    () =>
      googleDetailsToResponse({
        id: 'g.us.1',
        displayName: { text: 'Some Place' },
        formattedAddress: 'US Address',
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
        },
        types: ['establishment'],
        addressComponents: [
          {
            shortText: 'US',
            types: ['country', 'political'],
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
      assert.equal(response.code, 'EXTERNAL_SERVICE_ERROR');
      return true;
    },
  );
});

test('googleAutocompleteToResponse maps normalization errors to BAD_GATEWAY HttpException', () => {
  assert.throws(
    () =>
      googleAutocompleteToResponse({
        suggestions: [
          {
            placePrediction: {
              placeId: 'g.sg.3',
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

test('details call sets Google field mask and languageCode', () => {
  process.env.GOOGLE_MAPS_API_KEY = 'test-token';
  const service = new PlacesService() as unknown as {
    details: (placeId: string) => Promise<unknown>;
  };

  const originalFetch = global.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  global.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
    calls.push({ url: String(input), init });

    return new Response(
      JSON.stringify({
        id: 'test',
        displayName: { text: 'Test Place' },
        formattedAddress: 'Singapore',
        location: { latitude: 1.3, longitude: 103.8 },
        types: ['establishment'],
        addressComponents: [{ shortText: 'SG', types: ['country'] }],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;

  return service.details('abc123').then(() => {
    global.fetch = originalFetch;
    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.includes('/places/abc123?languageCode=en'));
    assert.equal((calls[0].init?.headers as Record<string, string>)['X-Goog-Api-Key'], 'test-token');
  });
});
