import { Controller, Get, Query } from '@nestjs/common';
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
    const { q: query } = PlacesAutocompleteQuerySchema.parse({ q });
    return this.placesService.autocomplete(query);
  }

  @Get('/details')
  async details(@Query('placeId') placeId: string): Promise<PlaceDetailsResponse> {
    const { placeId: parsedPlaceId } = PlaceDetailsQuerySchema.parse({ placeId });
    return this.placesService.details(parsedPlaceId);
  }
}