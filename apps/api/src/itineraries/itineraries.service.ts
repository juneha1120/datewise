import { Injectable } from '@nestjs/common';
import { GenerateItineraryRequest, GenerateItineraryResponse } from '@datewise/shared';
import { PlacesService } from '../places/places.service';
import { ItineraryBuilder } from './itinerary-builder';

@Injectable()
export class ItinerariesService {
  constructor(
    private readonly placesService: PlacesService,
    private readonly itineraryBuilder: ItineraryBuilder,
  ) {}

  /** Generates a places-only itinerary from nearby Google candidates. */
  async generateItinerary(request: GenerateItineraryRequest): Promise<GenerateItineraryResponse> {
    const candidateResponse = await this.placesService.candidatesNearOrigin(request.origin.placeId);
    return this.itineraryBuilder.build(request, candidateResponse.candidates);
  }
}
