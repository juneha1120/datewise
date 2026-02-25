import { ItineraryLeg, Transport } from '@datewise/shared';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { CacheStore, InMemoryCacheStore } from '../places/cache';
import { fetchJsonWithRetry } from '../places/http';

const GOOGLE_DIRECTIONS_API_BASE = 'https://maps.googleapis.com/maps/api/directions/json';
const DIRECTIONS_CACHE_TTL_MS = 5 * 60_000;

const GoogleDirectionsResponseSchema = z.object({
  status: z.string().min(1),
  routes: z
    .array(
      z.object({
        legs: z
          .array(
            z.object({
              distance: z.object({ value: z.number().int().min(1) }).optional(),
              duration: z.object({ value: z.number().int().min(1) }).optional(),
              steps: z
                .array(
                  z.object({
                    travel_mode: z.string().min(1),
                    distance: z.object({ value: z.number().int().min(0) }).optional(),
                  }),
                )
                .default([]),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
  error_message: z.string().optional(),
});

const DIRECTIONS_MODE_BY_TRANSPORT: Record<Transport, string> = {
  MIN_WALK: 'walking',
  WALK_OK: 'walking',
  TRANSIT: 'transit',
  DRIVE_OK: 'driving',
};

const LEG_MODE_BY_TRANSPORT: Record<Transport, ItineraryLeg['mode']> = {
  MIN_WALK: 'WALK',
  WALK_OK: 'WALK',
  TRANSIT: 'TRANSIT',
  DRIVE_OK: 'DRIVE',
};

export type RoutedLeg = {
  durationMin: number;
  distanceM: number;
  mode: ItineraryLeg['mode'];
  walkingDistanceM: number;
};

@Injectable()
export class DirectionsService {
  private readonly cache: CacheStore = new InMemoryCacheStore();

  /** Computes a single route leg between two coordinates via Google Directions. */
  async routeLeg(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
    transport: Transport,
  ): Promise<RoutedLeg> {
    const mode = DIRECTIONS_MODE_BY_TRANSPORT[transport];
    const cacheKey = `directions:${mode}:${from.lat},${from.lng}:${to.lat},${to.lng}`;
    const cached = this.cache.get<RoutedLeg>(cacheKey);
    if (cached) {
      return cached;
    }

    const url = new URL(GOOGLE_DIRECTIONS_API_BASE);
    url.searchParams.set('origin', `${from.lat},${from.lng}`);
    url.searchParams.set('destination', `${to.lat},${to.lng}`);
    url.searchParams.set('mode', mode);
    url.searchParams.set('key', process.env.GOOGLE_MAPS_API_KEY ?? '');

    const raw = await fetchJsonWithRetry<unknown>(url.toString());
    const parsed = GoogleDirectionsResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new HttpException(
        {
          code: 'INVALID_EXTERNAL_RESPONSE',
          message: 'Invalid route response from Google Directions.',
          details: parsed.error.flatten(),
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    const firstLeg = parsed.data.routes[0]?.legs[0];
    if (parsed.data.status !== 'OK' || !firstLeg?.distance || !firstLeg.duration) {
      throw new HttpException(
        {
          code: 'EXTERNAL_SERVICE_ERROR',
          message: 'Failed to compute route leg from Google Directions.',
          details: parsed.data.error_message ?? parsed.data.status,
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    const stepWalkingDistanceM = firstLeg.steps
      .filter((step) => step.travel_mode === 'WALKING')
      .reduce((sum, step) => sum + (step.distance?.value ?? 0), 0);

    const normalized: RoutedLeg = {
      durationMin: Math.max(1, Math.round(firstLeg.duration.value / 60)),
      distanceM: firstLeg.distance.value,
      mode: LEG_MODE_BY_TRANSPORT[transport],
      walkingDistanceM: LEG_MODE_BY_TRANSPORT[transport] === 'WALK' ? firstLeg.distance.value : stepWalkingDistanceM,
    };

    this.cache.set(cacheKey, normalized, DIRECTIONS_CACHE_TTL_MS);
    return normalized;
  }
}
