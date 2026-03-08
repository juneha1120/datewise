import { Injectable } from '@nestjs/common';

export type PlaceCandidate = {
  placeId: string;
  name: string;
  subgroup: string;
  lat: number;
  lng: number;
  rating: number;
  isOpen: boolean;
};

@Injectable()
export class PlacesProvider {
  async search(subgroup: string, near: { lat: number; lng: number }): Promise<PlaceCandidate[]> {
    const seed = Math.abs(Math.floor(near.lat * 1000 + near.lng * 1000));
    return Array.from({ length: 6 }).map((_, index) => ({
      placeId: `${subgroup}-${seed}-${index}`,
      name: `${subgroup.replaceAll('_', ' ')} Spot ${index + 1}`,
      subgroup,
      lat: near.lat + index * 0.002,
      lng: near.lng + index * 0.002,
      rating: 4.8 - index * 0.1,
      isOpen: true,
    }));
  }

  travelMinutes(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
    return Math.max(8, Math.floor((Math.abs(from.lat - to.lat) + Math.abs(from.lng - to.lng)) * 1300));
  }
}
