import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import {
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
