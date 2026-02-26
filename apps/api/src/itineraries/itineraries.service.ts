import { Injectable } from '@nestjs/common';
import {
  Candidate,
  GenerateItineraryRequest,
  GenerateItineraryResponse,
  ReplaceStopWithTextSearchRequest,
} from '@datewise/shared';
import { PlacesService } from '../places/places.service';
import { ItineraryBuilder } from './itinerary-builder';

@Injectable()
export class ItinerariesService {
  constructor(
    private readonly placesService: PlacesService,
    private readonly itineraryBuilder: ItineraryBuilder,
  ) {}

  /** Generates itinerary using canonical origin details resolved from the submitted placeId. */
  async generateItinerary(request: GenerateItineraryRequest): Promise<GenerateItineraryResponse> {
    const canonicalOrigin = await this.placesService.details(request.origin.placeId);
    const candidateResponse = await this.placesService.candidatesNearOrigin(request.origin.placeId);

    const itinerary = await this.itineraryBuilder.build(
      {
        ...request,
        origin: canonicalOrigin,
      },
      candidateResponse.candidates,
    );

    return {
      ...itinerary,
      meta: {
        ...itinerary.meta,
        textSearchOptions: this.placesService.textSearchOptionsForVibe(request.vibe),
      },
    };
  }

  async replaceStopWithTextSearch(request: ReplaceStopWithTextSearchRequest): Promise<GenerateItineraryResponse> {
    const options = await this.placesService.searchTextCandidates(request.originPlaceId, request.query);
    const originalStop = request.itinerary.stops[request.stopIndex];

    if (!originalStop || options.length === 0) {
      return request.itinerary;
    }

    const replacement = this.pickReplacement(options, originalStop.lat, originalStop.lng);

    const updatedStops = request.itinerary.stops.map((stop, index) => {
      if (index !== request.stopIndex) {
        return stop;
      }

      return {
        ...stop,
        name: replacement.name,
        lat: replacement.lat,
        lng: replacement.lng,
        address: replacement.address ?? stop.address,
        rating: replacement.rating ?? stop.rating,
        reviewCount: replacement.reviewCount ?? stop.reviewCount,
        priceLevel: replacement.priceLevel ?? stop.priceLevel,
        tags: replacement.tags ?? stop.tags,
        booking: replacement.booking,
        reason: `${stop.reason}; replaced with "${request.query}" option`,
      };
    });

    return {
      ...request.itinerary,
      stops: updatedStops,
      meta: {
        ...request.itinerary.meta,
        warnings: [...request.itinerary.meta.warnings, `Stop ${request.stopIndex + 1} replaced using "${request.query}".`],
      },
    };
  }

  private pickReplacement(candidates: readonly Candidate[], lat: number, lng: number): Candidate {
    const [best] = [...candidates].sort((left, right) => {
      const rightDistance = (right.lat - lat) ** 2 + (right.lng - lng) ** 2;
      const leftDistance = (left.lat - lat) ** 2 + (left.lng - lng) ** 2;

      if (right.rating !== left.rating) {
        return (right.rating ?? 0) - (left.rating ?? 0);
      }

      if (right.reviewCount !== left.reviewCount) {
        return (right.reviewCount ?? 0) - (left.reviewCount ?? 0);
      }

      return leftDistance - rightDistance;
    });

    return best;
  }
}
