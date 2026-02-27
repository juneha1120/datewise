import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import {
  GenerateItineraryRequest,
  GenerateItineraryRequestSchema,
  GenerateItineraryResponse,
  GenerateItineraryResponseSchema,
  GenerateItineraryResult,
} from '@datewise/shared';
import { z, ZodIssue } from 'zod';
import { ItinerariesService } from './itineraries.service';


const ReplaceStopWithTextSearchRequestSchema = z.object({
  originPlaceId: z.string().min(1),
  stopIndex: z.number().int().min(0),
  query: z.string().min(1),
  itinerary: GenerateItineraryResponseSchema,
});

function mapValidationIssues(issues: ZodIssue[]): Array<{ path: string; message: string }> {
  return issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

@Controller('/v1/itineraries')
export class ItinerariesController {
  constructor(private readonly itinerariesService: ItinerariesService) {}


  @Post('/replace-stop')
  async replaceStopWithTextSearch(@Body() body: unknown): Promise<GenerateItineraryResponse> {
    const parsedBody = ReplaceStopWithTextSearchRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: mapValidationIssues(parsedBody.error.issues),
      });
    }

    return this.itinerariesService.replaceStopWithTextSearch(parsedBody.data);
  }

  @Post('/generate')
  async generate(@Body() body: unknown): Promise<GenerateItineraryResult> {
    const parsedBody = GenerateItineraryRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: mapValidationIssues(parsedBody.error.issues),
      });
    }

    const request: GenerateItineraryRequest = parsedBody.data;
    return this.itinerariesService.generateItinerary(request);
  }

}
