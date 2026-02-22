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
      const tags = taggingService.inferTags({
        types,
        priceLevel,
        snippets: place.reviews
          .map((review) => review.text?.text ?? '')
          .filter((snippet) => snippet.length > 0),
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
      });
    });
}

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
    const response = await fetchJsonWithRetry<unknown>(`${GOOGLE_API_BASE}/places:searchNearby`, {
      method: 'POST',
      headers: this.buildJsonHeaders(
        'places.id,places.displayName.text,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.types,places.addressComponents.shortText,places.addressComponents.types',
      ),
      body: JSON.stringify({
        includedTypes: ['restaurant', 'tourist_attraction', 'cafe', 'museum', 'park', 'shopping_mall'],
        maxResultCount: 20,
        rankPreference: 'POPULARITY',
        languageCode: 'en',
        locationRestriction: {
          circle: {
            center: {
              latitude: origin.lat,
              longitude: origin.lng,
            },
            radius: 7_000,
          },
        },
      }),
    });

    const normalized = DebugPlaceCandidatesResponseSchema.parse({
      originPlaceId,
      candidates: googleNearbyToCandidates(response, this.taggingService),
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
