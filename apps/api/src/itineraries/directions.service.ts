import { ItineraryLeg, RadiusMode } from '@datewise/shared';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { CacheStore, InMemoryCacheStore } from '../places/cache';
import { fetchJsonWithRetry } from '../places/http';

const GOOGLE_DIRECTIONS_API_BASE = 'https://maps.googleapis.com/maps/api/directions/json';
const DIRECTIONS_CACHE_TTL_MS = 5 * 60_000;

const GoogleDirectionsResponseSchema = z.object({
  status: z.string().min(1),
  routes: z.array(z.object({ legs: z.array(z.object({ distance: z.object({ value: z.number().int().min(1) }).optional(), duration: z.object({ value: z.number().int().min(1) }).optional(), steps: z.array(z.object({ travel_mode: z.string().min(1), distance: z.object({ value: z.number().int().min(0) }).optional() })).default([]) })).default([]) })).default([]),
  error_message: z.string().optional(),
});

export type RoutedLeg = { durationMin: number; distanceM: number; mode: ItineraryLeg['mode']; walkingDistanceM: number };

function modeToDirections(mode: RadiusMode): { requestMode: string; legMode: ItineraryLeg['mode'] } {
  if (mode === 'WALKABLE') return { requestMode: 'walking', legMode: 'WALK' };
  if (mode === 'CAR_GRAB') return { requestMode: 'driving', legMode: 'DRIVE' };
  return { requestMode: 'transit', legMode: 'TRANSIT' };
}

@Injectable()
export class DirectionsService {
  private readonly cache: CacheStore = new InMemoryCacheStore();

  async routeLeg(from: { lat: number; lng: number }, to: { lat: number; lng: number }, radiusMode: RadiusMode): Promise<RoutedLeg> {
    const mode = modeToDirections(radiusMode);
    const cacheKey = `directions:${mode.requestMode}:${from.lat},${from.lng}:${to.lat},${to.lng}`;
    const cached = this.cache.get<RoutedLeg>(cacheKey);
    if (cached) return cached;

    try {
      const routed = await this.fetchLeg(from, to, mode.requestMode, mode.legMode);
      this.cache.set(cacheKey, routed, DIRECTIONS_CACHE_TTL_MS);
      return routed;
    } catch (error) {
      if (radiusMode === 'SHORT_TRANSIT') {
        const fallback = await this.fetchLeg(from, to, 'walking', 'WALK');
        this.cache.set(cacheKey, fallback, DIRECTIONS_CACHE_TTL_MS);
        return fallback;
      }
      throw error;
    }
  }

  private async fetchLeg(from: { lat: number; lng: number }, to: { lat: number; lng: number }, requestMode: string, legMode: ItineraryLeg['mode']): Promise<RoutedLeg> {
    const url = new URL(GOOGLE_DIRECTIONS_API_BASE);
    url.searchParams.set('origin', `${from.lat},${from.lng}`);
    url.searchParams.set('destination', `${to.lat},${to.lng}`);
    url.searchParams.set('mode', requestMode);
    url.searchParams.set('key', process.env.GOOGLE_MAPS_API_KEY ?? '');

    const raw = await fetchJsonWithRetry<unknown>(url.toString());
    const parsed = GoogleDirectionsResponseSchema.safeParse(raw);
    if (!parsed.success) throw new HttpException({ code: 'INVALID_EXTERNAL_RESPONSE', message: 'Invalid route response from Google Directions.' }, HttpStatus.BAD_GATEWAY);

    const firstLeg = parsed.data.routes[0]?.legs[0];
    if (parsed.data.status !== 'OK' || !firstLeg?.distance || !firstLeg.duration) {
      throw new HttpException({ code: 'EXTERNAL_SERVICE_ERROR', message: 'Failed to compute route leg from Google Directions.', details: parsed.data.error_message ?? parsed.data.status }, HttpStatus.BAD_GATEWAY);
    }

    const stepWalkingDistanceM = firstLeg.steps.filter((step) => step.travel_mode === 'WALKING').reduce((sum, step) => sum + (step.distance?.value ?? 0), 0);
    return { durationMin: Math.max(1, Math.round(firstLeg.duration.value / 60)), distanceM: firstLeg.distance.value, mode: legMode, walkingDistanceM: stepWalkingDistanceM };
  }
}
