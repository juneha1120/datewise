import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import {
  GenerateItineraryRequestSchema,
  GenerateItineraryResponse,
  GenerateItineraryRequest,
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
  generate(@Body() body: unknown): GenerateItineraryResponse {
    const parsedBody = GenerateItineraryRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: mapValidationIssues(parsedBody.error.issues),
      });
    }

    const request: GenerateItineraryRequest = parsedBody.data;
    return this.itinerariesService.generateStubItinerary(request);
  }
}
