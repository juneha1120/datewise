import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  Candidate,
  CandidateSchema,
  DebugPlaceCandidatesResponse,
  DebugPlaceCandidatesResponseSchema,
  PlaceDetailsResponse,
  PlaceDetailsResponseSchema,
  PlacesAutocompleteResponse,
  PlacesAutocompleteResponseSchema,
} from '@datewise/shared';
import { z } from 'zod';
import { CacheStore, InMemoryCacheStore } from './cache';
import { fetchJsonWithRetry } from './http';
import { TaggingService } from './tagging.service';

const SINGAPORE_COUNTRY_CODE = 'SG';
const GOOGLE_API_BASE = 'https://places.googleapis.com/v1';

const MAX_ORIGIN_DISTANCE_M = 2_000;
const NEARBY_SEARCH_RADIUS_M = 7_000;
const TEXT_SEARCH_MAX_RESULTS = 3;

const INCLUDED_NEARBY_TYPES = [
  'restaurant',
  'cafe',
  'bar',
  'bakery',
  'meal_takeaway',
  'art_gallery',
  'museum',
  'movie_theater',
  'spa',
  'bowling_alley',
  'amusement_park',
  'tourist_attraction',
  'park',
  'natural_feature',
  'shopping_mall',
  'book_store',
  'clothing_store',
  'store',
] as const;

const TEXT_SEARCH_QUERIES = [
  'pottery workshop Singapore',
  'art workshop Singapore',
  'painting class Singapore',
  'cooking class Singapore',
  'perfume workshop Singapore',
  'leather workshop Singapore',
  'escape room Singapore',
  'board game cafe Singapore',
  'arcade Singapore',
  'trampoline park Singapore',
  'indoor playground adults Singapore',
  'mini golf Singapore',
  'rooftop bar Singapore',
  'fine dining restaurant Singapore',
  'romantic restaurant Singapore',
  'skyline view Singapore',
  'river walk Singapore',
  'cycling park Singapore',
  'hiking trail Singapore',
  'nature trail Singapore',
  'water sports Singapore',
  'kayaking Singapore',
  'aesthetic cafe Singapore',
  'dessert cafe Singapore',
  'wine bar Singapore',
  'hidden cafe Singapore',
  'speakeasy Singapore',
] as const;

const BOOKING_KEYWORDS = [
  'reservation',
  'reserve',
  'booking',
  'fully booked',
  'queue',
  'appointment',
  'ticket',
  'slot',
  'waitlist',
  'advance',
  'prebook',
] as const;


const GoogleAutocompleteResponseSchema = z.object({
  suggestions: z.array(
    z.object({
      placePrediction: z
        .object({
          placeId: z.string().min(1),
          text: z
            .object({
              text: z.string().min(1),
            })
            .optional(),
          structuredFormat: z
            .object({
              mainText: z.object({ text: z.string().min(1) }).optional(),
              secondaryText: z.object({ text: z.string().min(1) }).optional(),
            })
            .optional(),
        })
        .optional(),
    }),
  ),
});

const GooglePlaceDetailsResponseSchema = z.object({
  id: z.string().min(1),
  displayName: z.object({ text: z.string().min(1) }).optional(),
  formattedAddress: z.string().min(1).optional(),
  location: z.object({ latitude: z.number(), longitude: z.number() }).optional(),
  types: z.array(z.string()).default([]),
  addressComponents: z
    .array(
      z.object({
        shortText: z.string().optional(),
        types: z.array(z.string()).default([]),
      }),
    )
    .default([]),
});

const GoogleNearbySearchResponseSchema = z.object({
  places: z
    .array(
      z.object({
        id: z.string().min(1),
        displayName: z.object({ text: z.string().min(1) }).optional(),
        formattedAddress: z.string().min(1).optional(),
        location: z
          .object({
            latitude: z.number(),
            longitude: z.number(),
          })
          .optional(),
        rating: z.number().min(0).max(5).optional(),
        userRatingCount: z.number().int().min(0).optional(),
        priceLevel: z
          .enum([
            'PRICE_LEVEL_FREE',
            'PRICE_LEVEL_INEXPENSIVE',
            'PRICE_LEVEL_MODERATE',
            'PRICE_LEVEL_EXPENSIVE',
            'PRICE_LEVEL_VERY_EXPENSIVE',
          ])
          .optional(),
        types: z.array(z.string()).default([]),
        reviews: z
          .array(
            z.object({
              text: z.object({ text: z.string().min(1) }).optional(),
            }),
          )
          .default([]),
        addressComponents: z
          .array(
            z.object({
              shortText: z.string().optional(),
              types: z.array(z.string()).default([]),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
});

const priceLevelMap: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

/** Normalizes Google autocomplete payloads into the shared API contract. */
export function googleAutocompleteToResponse(payload: unknown): PlacesAutocompleteResponse {
  const parsed = GoogleAutocompleteResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new HttpException(
      {
        code: 'INVALID_EXTERNAL_RESPONSE',
        message: 'Invalid autocomplete response from Google Places.',
        details: parsed.error.flatten(),
      },
      HttpStatus.BAD_GATEWAY,
    );
  }

  const normalized = PlacesAutocompleteResponseSchema.safeParse({
    suggestions: parsed.data.suggestions
      .map((suggestion) => suggestion.placePrediction)
      .filter((prediction): prediction is NonNullable<typeof prediction> => Boolean(prediction))
      .map((prediction) => {
        const primaryText =
          prediction.structuredFormat?.mainText?.text ??
          prediction.text?.text ??
          prediction.structuredFormat?.secondaryText?.text ??
          '';

        const secondaryText = prediction.structuredFormat?.secondaryText?.text ?? '';

        return {
          placeId: prediction.placeId,
          primaryText,
          secondaryText,
        };
      }),
  });

  if (!normalized.success) {
    throw new HttpException(
      {
        code: 'INVALID_EXTERNAL_RESPONSE',
        message: 'Invalid autocomplete response from Google Places.',
        details: normalized.error.flatten(),
      },
      HttpStatus.BAD_GATEWAY,
    );
  }

  return normalized.data;
}

/** Normalizes Google place details and enforces Singapore-only scope. */
export function googleDetailsToResponse(payload: unknown): PlaceDetailsResponse {
  const parsed = GooglePlaceDetailsResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new HttpException(
      {
        code: 'INVALID_EXTERNAL_RESPONSE',
        message: 'Invalid place details response from Google Places.',
        details: parsed.error.flatten(),
      },
      HttpStatus.BAD_GATEWAY,
    );
  }

  // Datewise only serves Singapore itineraries, so we fail fast on out-of-scope results.
  if (!isSingaporeAddress(parsed.data.addressComponents)) {
    throw new HttpException(
      {
        code: 'EXTERNAL_SERVICE_ERROR',
        message: 'Google place details result is outside Singapore.',
      },
      HttpStatus.BAD_GATEWAY,
    );
  }

  if (!parsed.data.location) {
    throw new HttpException(
      {
        code: 'INVALID_EXTERNAL_RESPONSE',
        message: 'Google place details missing location.',
      },
      HttpStatus.BAD_GATEWAY,
    );
  }

  const normalized = PlaceDetailsResponseSchema.safeParse({
    placeId: parsed.data.id,
    name: parsed.data.displayName?.text ?? parsed.data.formattedAddress ?? '',
    formattedAddress: parsed.data.formattedAddress ?? '',
    lat: parsed.data.location.latitude,
    lng: parsed.data.location.longitude,
    types: parsed.data.types,
  });

  if (!normalized.success) {
    throw new HttpException(
      {
        code: 'INVALID_EXTERNAL_RESPONSE',
        message: 'Invalid place details response from Google Places.',
        details: normalized.error.flatten(),
      },
      HttpStatus.BAD_GATEWAY,
    );
  }

  return normalized.data;
}

/** Converts nearby results into scored candidates with deterministic tag inference. */
export function googleNearbyToCandidates(
  payload: unknown,
  taggingService: TaggingService = new TaggingService(),
): Candidate[] {
  const parsed = GoogleNearbySearchResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new HttpException(
      {
        code: 'INVALID_EXTERNAL_RESPONSE',
        message: 'Invalid nearby places response from Google Places.',
        details: parsed.error.flatten(),
      },
      HttpStatus.BAD_GATEWAY,
    );
  }

  return parsed.data.places
    .filter((place) => place.location)
    .filter((place) => isSingaporeAddress(place.addressComponents))
    .map((place) => {
      const types = place.types.filter((type) => type.length > 0);
      const priceLevel = place.priceLevel ? priceLevelMap[place.priceLevel] : undefined;
      const snippets = place.reviews
        .map((review) => review.text?.text ?? '')
        .filter((snippet) => snippet.length > 0);
      const tags = taggingService.inferTags({
        types,
        priceLevel,
        snippets,
      });
      const booking = inferBookingSignal({
        types,
        priceLevel,
        rating: place.rating,
        reviewCount: place.userRatingCount,
        snippets,
      });

      return CandidateSchema.parse({
        kind: 'PLACE',
        externalId: place.id,
        name: place.displayName?.text ?? place.formattedAddress ?? 'Unknown place',
        lat: place.location?.latitude,
        lng: place.location?.longitude,
        address: place.formattedAddress,
        rating: place.rating,
        reviewCount: place.userRatingCount,
        priceLevel,
        types,
        tags,
        booking,
      });
    });
}



function inferBookingSignal(input: {
  types: readonly string[];
  priceLevel: number | undefined;
  rating: number | undefined;
  reviewCount: number | undefined;
  snippets: readonly string[];
}): { score: number; label: 'BOOK_AHEAD' | 'CHECK_AVAILABILITY' | 'WALK_IN_LIKELY' } {
  const signals = new Set(input.types.map((type) => type.toLowerCase()));
  let score = 0;

  if (
    signals.has('spa') ||
    signals.has('escape_room') ||
    signals.has('amusement_park') ||
    signals.has('bowling_alley') ||
    signals.has('art_gallery') ||
    signals.has('movie_theater') ||
    signals.has('museum')
  ) {
    score += 60;
  } else if (signals.has('tourist_attraction') || signals.has('museum')) {
    score += 40;
  } else if (signals.has('bar')) {
    score += 25;
  } else if (signals.has('restaurant')) {
    score += 20;
  }

  if (input.priceLevel === 3) {
    score += 15;
  } else if (input.priceLevel === 4) {
    score += 25;
  }

  const reviews = input.reviewCount ?? 0;
  if (reviews >= 2_000) {
    score += 25;
  } else if (reviews >= 500) {
    score += 15;
  }

  if ((input.rating ?? 0) >= 4.5 && reviews >= 200) {
    score += 15;
  }

  const keywordHits = input.snippets
    .join(' ')
    .toLowerCase()
    .split(/\W+/u)
    .filter((word) => BOOKING_KEYWORDS.includes(word as (typeof BOOKING_KEYWORDS)[number])).length;

  score += Math.min(30, keywordHits * 5);

  const label = score >= 60 ? 'BOOK_AHEAD' : score >= 40 ? 'CHECK_AVAILABILITY' : 'WALK_IN_LIKELY';

  return {
    score,
    label,
  };
}

function mergeUniqueCandidates(candidates: readonly Candidate[]): Candidate[] {
  const byExternalId = new Map<string, Candidate>();
  for (const candidate of candidates) {
    if (!byExternalId.has(candidate.externalId)) {
      byExternalId.set(candidate.externalId, candidate);
    }
  }

  return [...byExternalId.values()];
}


function haversineDistanceMeters(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (value: number): number => (value * Math.PI) / 180;

  const latDistanceRad = toRadians(to.lat - from.lat);
  const lngDistanceRad = toRadians(to.lng - from.lng);
  const fromLatRad = toRadians(from.lat);
  const toLatRad = toRadians(to.lat);

  const a =
    Math.sin(latDistanceRad / 2) * Math.sin(latDistanceRad / 2) +
    Math.cos(fromLatRad) * Math.cos(toLatRad) * Math.sin(lngDistanceRad / 2) * Math.sin(lngDistanceRad / 2);

  return Math.round(earthRadiusMeters * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))));
}

// Country component checks are more reliable than formattedAddress text parsing.
function isSingaporeAddress(components: Array<{ shortText?: string; types: string[] }>): boolean {
  return components.some(
    (component) => component.types.includes('country') && component.shortText?.toUpperCase() === SINGAPORE_COUNTRY_CODE,
  );
}

@Injectable()
export class PlacesService {
  private readonly cache: CacheStore = new InMemoryCacheStore();

  constructor(private readonly taggingService: TaggingService = new TaggingService()) {}

  async autocomplete(query: string): Promise<PlacesAutocompleteResponse> {
    // Prefixes segregate cache entries by endpoint shape so keys cannot collide.
    const cacheKey = `autocomplete:${query}`;
    const cached = this.cache.get<PlacesAutocompleteResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const response = await fetchJsonWithRetry<unknown>(`${GOOGLE_API_BASE}/places:autocomplete`, {
      method: 'POST',
      headers: this.buildJsonHeaders(
        'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text',
      ),
      body: JSON.stringify({
        input: query,
        includedRegionCodes: ['sg'],
        languageCode: 'en',
        locationBias: {
          circle: {
            center: {
              latitude: 1.3521,
              longitude: 103.8198,
            },
            radius: 50_000,
          },
        },
      }),
    });

    const normalized = googleAutocompleteToResponse(response);
    this.cache.set(cacheKey, normalized, 60_000);
    return normalized;
  }

  async details(placeId: string): Promise<PlaceDetailsResponse> {
    // Details are reused by nearby search; a longer TTL reduces duplicate place lookups.
    const cacheKey = `details:${placeId}`;
    const cached = this.cache.get<PlaceDetailsResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const response = await fetchJsonWithRetry<unknown>(
      `${GOOGLE_API_BASE}/places/${encodeURIComponent(placeId)}?languageCode=en`,
      {
        headers: this.buildJsonHeaders(
          'id,displayName.text,formattedAddress,location,types,addressComponents.shortText,addressComponents.types',
        ),
      },
    );

    const normalized = googleDetailsToResponse(response);
    this.cache.set(cacheKey, normalized, 5 * 60_000);
    return normalized;
  }

  async candidatesNearOrigin(originPlaceId: string): Promise<DebugPlaceCandidatesResponse> {
    const cacheKey = `candidates:${originPlaceId}`;
    const cached = this.cache.get<DebugPlaceCandidatesResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const origin = await this.details(originPlaceId);
    const nearbyResponse = await fetchJsonWithRetry<unknown>(`${GOOGLE_API_BASE}/places:searchNearby`, {
      method: 'POST',
      headers: this.buildJsonHeaders(
        'places.id,places.displayName.text,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.types,places.addressComponents.shortText,places.addressComponents.types,places.reviews.text.text',
      ),
      body: JSON.stringify({
        includedTypes: INCLUDED_NEARBY_TYPES,
        maxResultCount: 20,
        rankPreference: 'POPULARITY',
        languageCode: 'en',
        locationRestriction: {
          circle: {
            center: {
              latitude: origin.lat,
              longitude: origin.lng,
            },
            radius: NEARBY_SEARCH_RADIUS_M,
          },
        },
      }),
    });

    const textSearchResponses = await Promise.all(
      TEXT_SEARCH_QUERIES.map((textQuery) =>
        fetchJsonWithRetry<unknown>(`${GOOGLE_API_BASE}/places:searchText`, {
          method: 'POST',
          headers: this.buildJsonHeaders(
            'places.id,places.displayName.text,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.types,places.addressComponents.shortText,places.addressComponents.types,places.reviews.text.text',
          ),
          body: JSON.stringify({
            textQuery,
            maxResultCount: TEXT_SEARCH_MAX_RESULTS,
            languageCode: 'en',
            regionCode: 'SG',
            locationBias: {
              circle: {
                center: {
                  latitude: origin.lat,
                  longitude: origin.lng,
                },
                radius: NEARBY_SEARCH_RADIUS_M,
              },
            },
          }),
        }),
      ),
    );

    const nearbyCandidates = googleNearbyToCandidates(nearbyResponse, this.taggingService);
    const textSearchCandidates = textSearchResponses.flatMap((payload) => googleNearbyToCandidates(payload, this.taggingService));

    const normalizedCandidates = mergeUniqueCandidates([...nearbyCandidates, ...textSearchCandidates]).filter((candidate) => {
      return haversineDistanceMeters(origin, { lat: candidate.lat, lng: candidate.lng }) <= MAX_ORIGIN_DISTANCE_M;
    });

    const normalized = DebugPlaceCandidatesResponseSchema.parse({
      originPlaceId,
      candidates: normalizedCandidates,
    });

    this.cache.set(cacheKey, normalized, 60_000);
    return normalized;
  }

  private buildJsonHeaders(fieldMask: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': this.getApiKey(),
      'X-Goog-FieldMask': fieldMask,
    };
  }

  private getApiKey(): string {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      throw new HttpException(
        {
          code: 'MISSING_CONFIGURATION',
          message: 'GOOGLE_MAPS_API_KEY is required.',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return apiKey;
  }
}
