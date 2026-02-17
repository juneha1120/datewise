import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import {
  PlaceDetailsQuerySchema,
  PlaceDetailsResponse,
  PlacesAutocompleteQuerySchema,
  PlacesAutocompleteResponse,
} from '@datewise/shared';
import { ZodError } from 'zod';
import { PlacesService } from './places.service';

@Controller('/v1/places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get('/autocomplete')
  async autocomplete(@Query('q') q: string): Promise<PlacesAutocompleteResponse> {
    const { q: query } = this.parseOrThrowBadRequest(() => PlacesAutocompleteQuerySchema.parse({ q }));
    return this.placesService.autocomplete(query);
  }

  @Get('/details')
  async details(@Query('placeId') placeId: string): Promise<PlaceDetailsResponse> {
    const { placeId: parsedPlaceId } = this.parseOrThrowBadRequest(() =>
      PlaceDetailsQuerySchema.parse({ placeId }),
    );
    return this.placesService.details(parsedPlaceId);
  }

  private parseOrThrowBadRequest<T>(parse: () => T): T {
    try {
      return parse();
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException({
          message: 'Invalid request query parameters',
          errors: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        });
      }

      throw error;
    }
  }
}
