import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import {
  GenerateItineraryRequest,
  GenerateItineraryRequestSchema,
  GenerateItineraryResult,
  GenerateItineraryResponse,
  ReplaceStopWithTextSearchRequest,
  ReplaceStopWithTextSearchRequestSchema,
} from '@datewise/shared';
import { ZodIssue } from 'zod';
import { ItinerariesService } from './itineraries.service';

function mapValidationIssues(issues: ZodIssue[]): Array<{ path: string; message: string }> {
  return issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

@Controller('/v1/itineraries')
export class ItinerariesController {
  constructor(private readonly itinerariesService: ItinerariesService) {}

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

  @Post('/replace-stop-with-text-search')
  async replaceStopWithTextSearch(@Body() body: unknown): Promise<GenerateItineraryResponse> {
    const parsedBody = ReplaceStopWithTextSearchRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: mapValidationIssues(parsedBody.error.issues),
      });
    }

    const request: ReplaceStopWithTextSearchRequest = parsedBody.data;
    return this.itinerariesService.replaceStopWithTextSearch(request);
  }
}
