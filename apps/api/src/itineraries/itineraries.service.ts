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

  /** Generates itinerary using canonical origin details resolved from the submitted placeId. */
  async generateItinerary(request: GenerateItineraryRequest): Promise<GenerateItineraryResponse> {
    const canonicalOrigin = await this.placesService.details(request.origin.placeId);
    const candidateResponse = await this.placesService.candidatesNearOrigin(request.origin.placeId);

    return await this.itineraryBuilder.build(
      {
        ...request,
        origin: canonicalOrigin,
      },
      candidateResponse.candidates,
    );
  }
}
