import { BadGatewayException, Injectable } from '@nestjs/common';
import { fetchWithRetry } from '../external-http';

export type PlaceCandidate = {
  placeId: string;
  name: string;
  subgroup: string;
  lat: number;
  lng: number;
  rating: number;
  isOpen: boolean;
  address: string;
};

const SEARCH_RADII_KM = [3, 5, 8] as const;

const SUBGROUP_QUERY: Record<string, string> = {
  JAPANESE: 'Japanese restaurant',
  KOREAN: 'Korean restaurant',
  CHINESE: 'Chinese restaurant',
  THAI: 'Thai restaurant',
  WESTERN: 'Western restaurant',
  ITALIAN: 'Italian restaurant',
  INDIAN: 'Indian restaurant',
  MALAY: 'Malay restaurant',
  INDONESIAN: 'Indonesian restaurant',
  VIETNAMESE: 'Vietnamese restaurant',
  MIDDLE_EASTERN: 'Middle Eastern restaurant',
  SEAFOOD: 'Seafood restaurant',
  LOCAL: 'Local Singapore restaurant',
  HAWKER: 'Hawker centre food',
  MUSEUM: 'museum',
  GALLERY: 'art gallery',
  EXHIBITION: 'exhibition',
  SHOPPING: 'shopping mall',
  WELLNESS: 'spa wellness',
  CINEMA: 'cinema',
  CLASSES: 'workshop class',
  WALK_IN_PARK: 'park',
  SCENIC_WALK: 'scenic walk',
  ARCADE: 'arcade',
  BOWLING: 'bowling alley',
  KARAOKE: 'karaoke',
  ESCAPE_ROOM: 'escape room',
  INDOOR_SPORTS: 'indoor sports',
  OUTDOOR_ACTIVITY: 'outdoor activity',
  ATTRACTION: 'tourist attraction',
  COFFEE: 'coffee shop',
  DESSERT: 'dessert cafe',
  BUBBLE_TEA: 'bubble tea',
  TEA_HOUSE: 'tea house',
  COCKTAIL: 'cocktail bar',
  WINE: 'wine bar',
  BEER: 'beer bar',
  SPIRIT: 'bar',
};

type GoogleSearchPlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  rating?: number;
  location?: { latitude?: number; longitude?: number };
  currentOpeningHours?: { openNow?: boolean };
};

type GoogleSearchResponse = { places?: GoogleSearchPlace[] };

@Injectable()
export class PlacesProvider {
  private apiKey() {
    return process.env.GOOGLE_MAPS_API_KEY?.trim() || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || '';
  }

  async search(subgroup: string, near: { lat: number; lng: number }, arrivalAt: Date): Promise<PlaceCandidate[]> {
    const key = this.apiKey();
    if (!key) {
      return this.seedFallbackCandidates(subgroup, near, arrivalAt);
    }

    for (const radiusKm of SEARCH_RADII_KM) {
      const candidates = await this.searchGooglePlaces(subgroup, near, radiusKm, key);
      if (candidates.length >= 3) return candidates;
    }

    return [];
  }

  private async searchGooglePlaces(subgroup: string, near: { lat: number; lng: number }, radiusKm: number, key: string): Promise<PlaceCandidate[]> {
    const textQuery = `${SUBGROUP_QUERY[subgroup] ?? subgroup.replaceAll('_', ' ')} in Singapore`;
    const response = await fetchWithRetry(
      'https://places.googleapis.com/v1/places:searchText',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask':
            'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.currentOpeningHours',
        },
        body: JSON.stringify({
          textQuery,
          pageSize: 8,
          regionCode: 'SG',
          languageCode: 'en',
          rankPreference: 'DISTANCE',
          locationBias: {
            circle: {
              center: {
                latitude: near.lat,
                longitude: near.lng,
              },
              radius: radiusKm * 1000,
            },
          },
        }),
      },
      8000,
      1,
    );

    if (!response.ok) {
      const message = await response.text();
      throw new BadGatewayException(`Google Places search failed: ${message || response.status}`);
    }

    const body = (await response.json()) as GoogleSearchResponse;
    return (body.places ?? [])
      .filter((place) => this.inSingapore(place.location?.latitude, place.location?.longitude))
      .map((place) => ({
        placeId: place.id ?? `${subgroup}-${place.displayName?.text ?? 'unknown'}`,
        name: place.displayName?.text ?? subgroup.replaceAll('_', ' '),
        subgroup,
        lat: place.location?.latitude ?? near.lat,
        lng: place.location?.longitude ?? near.lng,
        rating: place.rating ?? 0,
        isOpen: place.currentOpeningHours?.openNow ?? true,
        address: place.formattedAddress ?? 'Singapore',
      }));
  }

  private seedFallbackCandidates(subgroup: string, near: { lat: number; lng: number }, arrivalAt: Date): PlaceCandidate[] {
    const hour = arrivalAt.getUTCHours();

    for (const radiusKm of SEARCH_RADII_KM) {
      const candidates = this.seedCandidates(subgroup, near, radiusKm, hour).filter((candidate) => candidate.isOpen && this.inSingapore(candidate.lat, candidate.lng));
      if (candidates.length >= 3) return candidates;
    }

    return [];
  }

  private seedCandidates(subgroup: string, near: { lat: number; lng: number }, radiusKm: number, hour: number): PlaceCandidate[] {
    const seed = Math.abs(Math.floor(near.lat * 10_000 + near.lng * 10_000 + radiusKm * 100));
    return Array.from({ length: 6 }).map((_, index) => {
      const offset = (radiusKm / 111) * (index + 1) * 0.12;
      const lat = near.lat + offset;
      const lng = near.lng + offset;
      const openHour = subgroup === 'COCKTAIL' || subgroup === 'BEER' || subgroup === 'SPIRIT' ? 10 : 1;
      const closeHour = subgroup === 'COCKTAIL' || subgroup === 'BEER' || subgroup === 'SPIRIT' ? 23 : 22;
      const isOpen = hour >= openHour && hour <= closeHour;
      return {
        placeId: `${subgroup}-${seed}-${index}`,
        name: `${subgroup.replaceAll('_', ' ')} Spot ${index + 1}`,
        subgroup,
        lat,
        lng,
        rating: 4.9 - index * 0.1,
        isOpen,
        address: `${Math.round(radiusKm * 100) / 100}km from start, Singapore`,
      };
    });
  }

  private inSingapore(lat?: number, lng?: number) {
    if (lat === undefined || lng === undefined) return false;
    return lat >= 1.20 && lat <= 1.48 && lng >= 103.6 && lng <= 104.05;
  }

  travelMinutes(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
    return Math.max(8, Math.floor((Math.abs(from.lat - to.lat) + Math.abs(from.lng - to.lng)) * 1300));
  }
}
