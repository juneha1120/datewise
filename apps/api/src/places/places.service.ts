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

const GOOGLE_AUTOCOMPLETE_RESPONSE_SCHEMA = z.object({
  predictions: z.array(
    z.object({
      place_id: z.string().min(1),
      structured_formatting: z.object({
        main_text: z.string().min(1),
        secondary_text: z.string().optional(),
      }),
    }),
  ),
  status: z.string(),
});

const GOOGLE_PLACE_DETAILS_RESPONSE_SCHEMA = z.object({
  result: z.object({
    place_id: z.string().min(1),
    name: z.string().min(1),
    formatted_address: z.string().min(1),
    geometry: z.object({
      location: z.object({
        lat: z.number(),
        lng: z.number(),
      }),
    }),
    types: z.array(z.string()),
  }),
  status: z.string(),
});

@Injectable()
export class PlacesService {
  private readonly cache: CacheStore = new InMemoryCacheStore();

  async autocomplete(query: string): Promise<PlacesAutocompleteResponse> {
    const cacheKey = `autocomplete:${query}`;
    const cached = this.cache.get<PlacesAutocompleteResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const response = await fetchJsonWithRetry<unknown>(this.buildAutocompleteUrl(query));
    const parsed = GOOGLE_AUTOCOMPLETE_RESPONSE_SCHEMA.safeParse(response);
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

    if (parsed.data.status !== 'OK' && parsed.data.status !== 'ZERO_RESULTS') {
      throw new HttpException(
        {
          code: 'EXTERNAL_SERVICE_ERROR',
          message: `Google Places autocomplete status: ${parsed.data.status}`,
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    const normalized = PlacesAutocompleteResponseSchema.parse({
      suggestions: parsed.data.predictions.map((prediction) => ({
        placeId: prediction.place_id,
        primaryText: prediction.structured_formatting.main_text,
        secondaryText: prediction.structured_formatting.secondary_text ?? '',
      })),
    });

    this.cache.set(cacheKey, normalized, 60_000);
    return normalized;
  }

  async details(placeId: string): Promise<PlaceDetailsResponse> {
    const cacheKey = `details:${placeId}`;
    const cached = this.cache.get<PlaceDetailsResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const response = await fetchJsonWithRetry<unknown>(this.buildDetailsUrl(placeId));
    const parsed = GOOGLE_PLACE_DETAILS_RESPONSE_SCHEMA.safeParse(response);
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

    if (parsed.data.status !== 'OK') {
      throw new HttpException(
        {
          code: 'EXTERNAL_SERVICE_ERROR',
          message: `Google Places details status: ${parsed.data.status}`,
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    const normalized = PlaceDetailsResponseSchema.parse({
      placeId: parsed.data.result.place_id,
      name: parsed.data.result.name,
      formattedAddress: parsed.data.result.formatted_address,
      lat: parsed.data.result.geometry.location.lat,
      lng: parsed.data.result.geometry.location.lng,
      types: parsed.data.result.types,
    });

    this.cache.set(cacheKey, normalized, 5 * 60_000);
    return normalized;
  }

  private buildAutocompleteUrl(query: string): string {
    return this.buildUrl('https://maps.googleapis.com/maps/api/place/autocomplete/json', {
      input: query,
      key: this.getApiKey(),
      components: 'country:sg',
      language: 'en',
      types: 'geocode',
    });
  }

  private buildDetailsUrl(placeId: string): string {
    return this.buildUrl('https://maps.googleapis.com/maps/api/place/details/json', {
      place_id: placeId,
      key: this.getApiKey(),
      fields: 'place_id,name,formatted_address,geometry,types',
    });
  }

  private buildUrl(baseUrl: string, params: Record<string, string>): string {
    const searchParams = new URLSearchParams(params);
    return `${baseUrl}?${searchParams.toString()}`;
  }

  private getApiKey(): string {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      throw new HttpException(
        {
          code: 'MISSING_CONFIGURATION',
          message: 'GOOGLE_PLACES_API_KEY is required.',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return apiKey;
  }
}
