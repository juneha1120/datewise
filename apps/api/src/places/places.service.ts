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

const MAPBOX_SG_COUNTRY_CODE = 'sg';

const MapboxContextCountrySchema = z
  .object({
    country_code: z.string().optional(),
  })
  .optional();

const MapboxFeatureSchema = z.object({
  id: z.string().optional(),
  properties: z
    .object({
      mapbox_id: z.string().min(1),
      name: z.string().min(1).optional(),
      full_address: z.string().optional(),
      place_formatted: z.string().optional(),
      feature_type: z.string().optional(),
      context: z
        .object({
          country: MapboxContextCountrySchema,
        })
        .optional(),
    })
    .optional(),
  geometry: z
    .object({
      coordinates: z.tuple([z.number(), z.number()]),
    })
    .optional(),
  name: z.string().optional(),
  place_name: z.string().optional(),
  place_formatted: z.string().optional(),
});

const MAPBOX_AUTOCOMPLETE_RESPONSE_SCHEMA = z.object({
  features: z.array(MapboxFeatureSchema),
});

const MAPBOX_DETAILS_RESPONSE_SCHEMA = z.object({
  features: z.array(MapboxFeatureSchema).min(1),
});

export function mapboxAutocompleteToResponse(payload: unknown): PlacesAutocompleteResponse {
  const parsed = MAPBOX_AUTOCOMPLETE_RESPONSE_SCHEMA.safeParse(payload);
  if (!parsed.success) {
    throw new HttpException(
      {
        code: 'INVALID_EXTERNAL_RESPONSE',
        message: 'Invalid autocomplete response from Mapbox.',
        details: parsed.error.flatten(),
      },
      HttpStatus.BAD_GATEWAY,
    );
  }

  const normalized = PlacesAutocompleteResponseSchema.safeParse({
    suggestions: parsed.data.features
      .filter((feature) => isSingaporeFeature(feature))
      .map((feature) => ({
        placeId: feature.properties?.mapbox_id ?? feature.id ?? '',
        primaryText: feature.properties?.name ?? feature.name ?? '',
        secondaryText:
          feature.properties?.full_address ??
          feature.place_formatted ??
          feature.properties?.place_formatted ??
          feature.place_name ??
          '',
      })),
  });

  if (!normalized.success) {
    throw new HttpException(
      {
        code: 'INVALID_EXTERNAL_RESPONSE',
        message: 'Invalid autocomplete response from Mapbox.',
        details: normalized.error.flatten(),
      },
      HttpStatus.BAD_GATEWAY,
    );
  }

  return normalized.data;
}

export function mapboxDetailsToResponse(payload: unknown): PlaceDetailsResponse {
  const parsed = MAPBOX_DETAILS_RESPONSE_SCHEMA.safeParse(payload);
  if (!parsed.success) {
    throw new HttpException(
      {
        code: 'INVALID_EXTERNAL_RESPONSE',
        message: 'Invalid place details response from Mapbox.',
        details: parsed.error.flatten(),
      },
      HttpStatus.BAD_GATEWAY,
    );
  }

  const [feature] = parsed.data.features;
  if (!isSingaporeFeature(feature)) {
    throw new HttpException(
      {
        code: 'EXTERNAL_SERVICE_ERROR',
        message: 'Mapbox details result is outside Singapore.',
      },
      HttpStatus.BAD_GATEWAY,
    );
  }

  const coordinates = feature.geometry?.coordinates;
  if (!coordinates) {
    throw new HttpException(
      {
        code: 'INVALID_EXTERNAL_RESPONSE',
        message: 'Mapbox place details missing geometry coordinates.',
      },
      HttpStatus.BAD_GATEWAY,
    );
  }

  const [lng, lat] = coordinates;
  const normalized = PlaceDetailsResponseSchema.safeParse({
    placeId: feature.properties?.mapbox_id ?? feature.id ?? '',
    name: feature.properties?.name ?? feature.name ?? '',
    formattedAddress:
      feature.properties?.full_address ??
      feature.place_formatted ??
      feature.properties?.place_formatted ??
      feature.place_name ??
      '',
    lat,
    lng,
    types: [feature.properties?.feature_type ?? 'place'],
  });

  if (!normalized.success) {
    throw new HttpException(
      {
        code: 'INVALID_EXTERNAL_RESPONSE',
        message: 'Invalid place details response from Mapbox.',
        details: normalized.error.flatten(),
      },
      HttpStatus.BAD_GATEWAY,
    );
  }

  return normalized.data;
}

function isSingaporeFeature(feature: z.infer<typeof MapboxFeatureSchema>): boolean {
  const countryCode = feature.properties?.context?.country?.country_code;
  if (!countryCode) return false;

  return countryCode.toLowerCase() === MAPBOX_SG_COUNTRY_CODE;
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

    const response = await fetchJsonWithRetry<unknown>(this.buildAutocompleteUrl(query));
    const normalized = mapboxAutocompleteToResponse(response);

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
    const normalized = mapboxDetailsToResponse(response);

    this.cache.set(cacheKey, normalized, 5 * 60_000);
    return normalized;
  }

  private buildAutocompleteUrl(query: string): string {
    return this.buildUrl('https://api.mapbox.com/search/geocode/v6/forward', {
      q: query,
      access_token: this.getApiKey(),
      country: 'SG',
      language: 'en',
      autocomplete: 'true',
      limit: '8',
      proximity: '103.8198,1.3521',
      types: 'address,street,neighborhood,locality,place',
    });
  }

  private buildDetailsUrl(placeId: string): string {
    return this.buildUrl(`https://api.mapbox.com/search/geocode/v6/retrieve/${encodeURIComponent(placeId)}`, {
      access_token: this.getApiKey(),
      language: 'en',
    });
  }

  private buildUrl(baseUrl: string, params: Record<string, string>): string {
    const searchParams = new URLSearchParams(params);
    return `${baseUrl}?${searchParams.toString()}`;
  }

  private getApiKey(): string {
    const apiKey = process.env.MAPBOX_ACCESS_TOKEN;

    if (!apiKey) {
      throw new HttpException(
        {
          code: 'MISSING_CONFIGURATION',
          message: 'MAPBOX_ACCESS_TOKEN is required.',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return apiKey;
  }
}