import { test } from 'node:test';
import * as assert from 'node:assert/strict';
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
    suggestions: [{ placeId: 'g.sg.1', primaryText: 'Marina Bay Sands', secondaryText: 'Singapore' }],
  });
});

test('googleDetailsToResponse normalizes place details payload', () => {
  const response = googleDetailsToResponse({
    id: 'g.sg.2',
    displayName: { text: 'Clarke Quay MRT' },
    formattedAddress: '2 Eu Tong Sen St, Singapore',
    location: { latitude: 1.2881, longitude: 103.8463 },
    types: ['train_station'],
    addressComponents: [{ shortText: 'SG', types: ['country', 'political'] }],
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
        location: { latitude: 37.7749, longitude: -122.4194 },
        types: ['establishment'],
        addressComponents: [{ shortText: 'US', types: ['country', 'political'] }],
      }),
    (error: unknown) => {
      assert.ok(error instanceof HttpException);
      if (!(error instanceof HttpException)) {
        return false;
      }

      assert.equal(error.getStatus(), HttpStatus.BAD_GATEWAY);
      assert.equal((error.getResponse() as Record<string, unknown>).code, 'EXTERNAL_SERVICE_ERROR');
      return true;
    },
  );
});

test('googleAutocompleteToResponse maps normalization errors to BAD_GATEWAY HttpException', () => {
  assert.throws(
    () =>
      googleAutocompleteToResponse({
        suggestions: [{ placePrediction: { placeId: 'g.sg.3' } }],
      }),
    (error: unknown) => {
      assert.ok(error instanceof HttpException);
      if (!(error instanceof HttpException)) {
        return false;
      }

      assert.equal(error.getStatus(), HttpStatus.BAD_GATEWAY);
      assert.equal((error.getResponse() as Record<string, unknown>).code, 'INVALID_EXTERNAL_RESPONSE');
      return true;
    },
  );
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

  assert.equal(response.length, 1);
  assert.equal(response[0].externalId, 'g.sg.place1');
  assert.equal(response[0].name, 'Tiong Bahru Bakery');
  assert.deepEqual(response[0].types, ['bakery', 'cafe']);
  assert.deepEqual(response[0].tags, ['COZY', 'DATE_NIGHT']);
  const first = response[0] as (typeof response)[number] & { booking?: { label: string } };
  assert.ok(first.booking);
  assert.equal(first.booking?.label, 'WALK_IN_LIKELY');
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

test('details call sets Google field mask and languageCode', async () => {
  process.env.GOOGLE_MAPS_API_KEY = 'test-token';
  const service = new PlacesService() as unknown as { details: (placeId: string) => Promise<unknown> };

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

  try {
    await service.details('abc123');
    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.includes('/places/abc123?languageCode=en'));
    assert.equal((calls[0].init?.headers as Record<string, string>)['X-Goog-Api-Key'], 'test-token');
  } finally {
    global.fetch = originalFetch;
  }
});

test('candidatesNearOrigin sends nearby includedTypes without text-search fanout', async () => {
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

  try {
    await service.candidatesNearOrigin('origin');
    assert.equal(calls.length, 2);

    const nearbyCall = calls.find((call) => call.url.endsWith('/places:searchNearby'));
    assert.ok(nearbyCall);
    const fieldMask = ((nearbyCall as { init?: RequestInit }).init?.headers as Record<string, string>)['X-Goog-FieldMask'];
    assert.ok(fieldMask.includes('places.reviews.text.text'));

    const nearbyBody = JSON.parse(String((nearbyCall as { init?: RequestInit }).init?.body ?? '{}')) as Record<string, unknown>;
    assert.ok(Array.isArray(nearbyBody.includedTypes));
    assert.ok((nearbyBody.includedTypes as unknown[]).includes('restaurant'));

    const textSearchCalls = calls.filter((call) => call.url.endsWith('/places:searchText'));
    assert.equal(textSearchCalls.length, 0);
  } finally {
    global.fetch = originalFetch;
  }
});


test('candidatesNearOrigin filters candidates beyond 2km from origin', async () => {
  process.env.GOOGLE_MAPS_API_KEY = 'test-token';
  const service = new PlacesService() as unknown as {
    candidatesNearOrigin: (originPlaceId: string) => Promise<{ candidates: Array<{ externalId: string }> }>;
  };

  const originalFetch = global.fetch;

  global.fetch = (async (input: URL | RequestInfo) => {
    const url = String(input);
    if (url.includes('/places/') && url.includes('?languageCode=en')) {
      return new Response(
        JSON.stringify({
          id: 'origin',
          displayName: { text: 'Origin Place' },
          formattedAddress: 'Singapore',
          location: { latitude: 1.3103694, longitude: 103.77117 },
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
            id: 'nearby-candidate',
            displayName: { text: 'Nearby Mall' },
            formattedAddress: 'Singapore',
            location: { latitude: 1.314918, longitude: 103.7643089 },
            types: ['shopping_mall'],
            addressComponents: [{ shortText: 'SG', types: ['country'] }],
          },
          {
            id: 'far-candidate',
            displayName: { text: 'Far Mall' },
            formattedAddress: 'Singapore',
            location: { latitude: 1.3039288, longitude: 103.8319492 },
            types: ['shopping_mall'],
            addressComponents: [{ shortText: 'SG', types: ['country'] }],
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;

  try {
    const result = await service.candidatesNearOrigin('origin');
    assert.deepEqual(result.candidates.map((candidate) => candidate.externalId), ['nearby-candidate']);
  } finally {
    global.fetch = originalFetch;
  }
});


test('candidatesNearOrigin falls back when nearby includedTypes request is rejected', async () => {
  process.env.GOOGLE_MAPS_API_KEY = 'test-token';
  const service = new PlacesService() as unknown as {
    candidatesNearOrigin: (originPlaceId: string) => Promise<{ candidates: Array<{ externalId: string }> }>;
  };

  const originalFetch = global.fetch;
  let nearbyAttempts = 0;

  global.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/places/') && url.includes('?languageCode=en')) {
      return new Response(
        JSON.stringify({
          id: 'origin',
          displayName: { text: 'Origin Place' },
          formattedAddress: 'Singapore',
          location: { latitude: 1.3103694, longitude: 103.77117 },
          types: ['establishment'],
          addressComponents: [{ shortText: 'SG', types: ['country'] }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (url.endsWith('/places:searchNearby')) {
      nearbyAttempts += 1;
      const body = JSON.parse(String(init?.body ?? '{}')) as { includedTypes?: unknown };

      if (nearbyAttempts === 1 && Array.isArray(body.includedTypes)) {
        return new Response(JSON.stringify({ error: { message: 'invalid type' } }), { status: 400 });
      }

      return new Response(
        JSON.stringify({
          places: [
            {
              id: 'fallback-nearby',
              displayName: { text: 'Fallback Nearby Place' },
              formattedAddress: 'Singapore',
              location: { latitude: 1.314918, longitude: 103.7643089 },
              types: ['shopping_mall'],
              addressComponents: [{ shortText: 'SG', types: ['country'] }],
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({ places: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;

  try {
    const response = await service.candidatesNearOrigin('origin');
    assert.equal(response.candidates[0]?.externalId, 'fallback-nearby');
    assert.ok(nearbyAttempts >= 2);
  } finally {
    global.fetch = originalFetch;
  }
});


test('textSearchOptionsForVibe returns curated options', () => {
  const service = new PlacesService();
  const options = service.textSearchOptionsForVibe('CREATIVE');

  assert.ok(options.includes('pottery workshop Singapore'));
  assert.ok(options.includes('painting class Singapore'));
});
