import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import {
  DebugPlaceCandidatesQuerySchema,
  DebugPlaceCandidatesResponse,
  PlaceDetailsQuerySchema,
  PlaceDetailsResponse,
  PlacesAutocompleteQuerySchema,
  PlacesAutocompleteResponse,
} from '@datewise/shared';
import { PlacesService } from './places.service';

@Controller('/v1/places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get('/autocomplete')
  async autocomplete(@Query('q') q: string): Promise<PlacesAutocompleteResponse> {
    const parsedQuery = PlacesAutocompleteQuerySchema.safeParse({ q });

    if (!parsedQuery.success) {
      throw new BadRequestException({
        code: 'INVALID_PLACES_AUTOCOMPLETE_QUERY',
        message: 'Invalid places autocomplete query parameters',
        issues: parsedQuery.error.issues,
      });
    }

    return this.placesService.autocomplete(parsedQuery.data.q);
  }

  @Get('/debug/candidates')
  async candidates(@Query('originPlaceId') originPlaceId: string): Promise<DebugPlaceCandidatesResponse> {
    const parsedQuery = DebugPlaceCandidatesQuerySchema.safeParse({ originPlaceId });

    if (!parsedQuery.success) {
      throw new BadRequestException({
        code: 'INVALID_PLACE_CANDIDATES_QUERY',
        message: 'Invalid places candidates query parameters',
        issues: parsedQuery.error.issues,
      });
    }

    return this.placesService.candidatesNearOrigin(parsedQuery.data.originPlaceId);
  }

  @Get('/details')
  async details(@Query('placeId') placeId: string): Promise<PlaceDetailsResponse> {
    const parsedQuery = PlaceDetailsQuerySchema.safeParse({ placeId });

    if (!parsedQuery.success) {
      throw new BadRequestException({
        code: 'INVALID_PLACE_DETAILS_QUERY',
        message: 'Invalid place details query parameters',
        issues: parsedQuery.error.issues,
      });
    }

    return this.placesService.details(parsedQuery.data.placeId);
  }
}
