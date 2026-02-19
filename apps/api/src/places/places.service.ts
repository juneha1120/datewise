import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  PlaceDetailsResponse,
  PlaceDetailsResponseSchema,
  PlacesAutocompleteResponse,
  PlacesAutocompleteResponseSchema,
} from '@datewise/shared';
import { z } from 'zod';
import { CacheStore, InMemoryCacheStore } from './cache';
import { fetchJsonWithRetry } from './http';

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

function isSingaporeAddress(
  components: Array<{ shortText?: string; types: string[] }>,
): boolean {
  return components.some((component) =>
    component.types.includes('country') && component.shortText?.toUpperCase() === SINGAPORE_COUNTRY_CODE,
  );
}

@Injectable()
export class PlacesService {
  private readonly cache: CacheStore = new InMemoryCacheStore();

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
        headers: this.buildJsonHeaders('id,displayName.text,formattedAddress,location,types,addressComponents.shortText,addressComponents.types'),
      },
    );

    const normalized = googleDetailsToResponse(response);
    this.cache.set(cacheKey, normalized, 5 * 60_000);
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
    const apiKey = process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      throw new HttpException(
        {
          code: 'MISSING_CONFIGURATION',
          message: 'GOOGLE_MAPS_API_KEY (or GOOGLE_API_KEY) is required.',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return apiKey;
  }
}
