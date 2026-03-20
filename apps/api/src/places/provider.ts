import { Injectable } from '@nestjs/common';

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

@Injectable()
export class PlacesProvider {
  async search(subgroup: string, near: { lat: number; lng: number }, arrivalAt: Date): Promise<PlaceCandidate[]> {
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

  private inSingapore(lat: number, lng: number) {
    return lat >= 1.20 && lat <= 1.48 && lng >= 103.6 && lng <= 104.05;
  }

  travelMinutes(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
    return Math.max(8, Math.floor((Math.abs(from.lat - to.lat) + Math.abs(from.lng - to.lng)) * 1300));
  }
}
