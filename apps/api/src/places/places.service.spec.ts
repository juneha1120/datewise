import { test } from 'node:test';
import * as assert from 'assert/strict';
import { HttpException, HttpStatus } from '@nestjs/common';
import { PlacesService, googleAutocompleteToResponse, googleDetailsToResponse, googleNearbyToCandidates } from './places.service';

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


test('googleNearbyToCandidates normalizes singapore nearby places', () => {
  const response = googleNearbyToCandidates({
    places: [
      {
        id: 'g.sg.place1',
        displayName: { text: 'Tiong Bahru Bakery' },
        formattedAddress: '56 Eng Hoon St, Singapore 160056',
        location: { latitude: 1.2851, longitude: 103.8321 },
        rating: 4.4,
        userRatingCount: 812,
        priceLevel: 'PRICE_LEVEL_MODERATE',
        types: ['bakery', 'cafe'],
        addressComponents: [{ shortText: 'SG', types: ['country', 'political'] }],
      },
    ],
  });

  assert.deepStrictEqual(response, [
    {
      kind: 'PLACE',
      externalId: 'g.sg.place1',
      name: 'Tiong Bahru Bakery',
      lat: 1.2851,
      lng: 103.8321,
      address: '56 Eng Hoon St, Singapore 160056',
      rating: 4.4,
      reviewCount: 812,
      priceLevel: 2,
      types: ['bakery', 'cafe'],
      tags: ['COZY', 'DATE_NIGHT'],
    },
  ]);
});

test('googleNearbyToCandidates filters out non-Singapore places', () => {
  const response = googleNearbyToCandidates({
    places: [
      {
        id: 'g.sg.place2',
        displayName: { text: 'National Gallery Singapore' },
        formattedAddress: "1 St Andrew's Rd, Singapore 178957",
        location: { latitude: 1.2906, longitude: 103.8516 },
        types: ['museum'],
        addressComponents: [{ shortText: 'SG', types: ['country'] }],
      },
      {
        id: 'g.us.place3',
        displayName: { text: 'Outside SG' },
        formattedAddress: 'Market St, San Francisco',
        location: { latitude: 37.7749, longitude: -122.4194 },
        types: ['restaurant'],
        addressComponents: [{ shortText: 'US', types: ['country'] }],
      },
    ],
  });

  assert.equal(response.length, 1);
  assert.equal(response[0].externalId, 'g.sg.place2');
});

test('googleNearbyToCandidates skips entries without location', () => {
  const response = googleNearbyToCandidates({
    places: [
      {
        id: 'g.sg.place4',
        displayName: { text: 'No Location Place' },
        formattedAddress: 'Singapore',
        types: ['park'],
        addressComponents: [{ shortText: 'SG', types: ['country'] }],
      },
    ],
  });

  assert.deepStrictEqual(response, []);
});


test('candidatesNearOrigin requests reviews in nearby field mask', () => {
  process.env.GOOGLE_MAPS_API_KEY = 'test-token';
  const service = new PlacesService() as unknown as {
    candidatesNearOrigin: (originPlaceId: string) => Promise<unknown>;
  };

  const originalFetch = global.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  global.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
    calls.push({ url: String(input), init });

    const url = String(input);
    if (url.includes('/places/') && url.includes('?languageCode=en')) {
      return new Response(
        JSON.stringify({
          id: 'origin',
          displayName: { text: 'Origin Place' },
          formattedAddress: 'Singapore',
          location: { latitude: 1.3, longitude: 103.8 },
          types: ['establishment'],
          addressComponents: [{ shortText: 'SG', types: ['country'] }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({
        places: [
          {
            id: 'candidate-1',
            displayName: { text: 'Romantic Cafe' },
            formattedAddress: 'Singapore',
            location: { latitude: 1.31, longitude: 103.81 },
            types: ['cafe'],
            reviews: [{ text: { text: 'great date night atmosphere' } }],
            addressComponents: [{ shortText: 'SG', types: ['country'] }],
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;

  return service.candidatesNearOrigin('origin').then(() => {
    global.fetch = originalFetch;
    assert.equal(calls.length, 2);

    const nearbyCall = calls[1];
    const fieldMask = (nearbyCall.init?.headers as Record<string, string>)['X-Goog-FieldMask'];
    assert.ok(fieldMask.includes('places.reviews.text.text'));
  });
});
