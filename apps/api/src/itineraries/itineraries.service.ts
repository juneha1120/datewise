import { Injectable } from '@nestjs/common';
import {
  GenerateItineraryRequest,
  GenerateItineraryResponse,
  GenerateItineraryResponseSchema,
} from '@datewise/shared';

@Injectable()
export class ItinerariesService {
  generateStubItinerary(request: GenerateItineraryRequest): GenerateItineraryResponse {
    const itineraryId = `iti_stub_${request.date}_${request.startTime.replace(':', '')}`;
    const primaryVibe = request.vibe[0];
    const primaryDateStyle = request.dateStyle[0];

    const stops = [
      {
        kind: 'PLACE' as const,
        name: `${request.origin.name} Meetup`,
        lat: request.origin.lat,
        lng: request.origin.lng,
        address: request.origin.formattedAddress,
        url: 'https://www.visitsingapore.com/',
        rating: 4.5,
        reviewCount: 800,
        priceLevel: 1,
        tags: ['START', 'SINGAPORE', ...request.vibe, ...request.dateStyle],
        reason: `Start near ${request.origin.name} with ${primaryVibe.toLowerCase()} ${primaryDateStyle.toLowerCase()} plans.`,
      },
      {
        kind: 'PLACE' as const,
        name: 'Marina Bay Sands SkyPark',
        lat: 1.2834,
        lng: 103.8607,
        address: '10 Bayfront Ave, Singapore 018956',
        url: 'https://www.marinabaysands.com/',
        rating: 4.7,
        reviewCount: 12000,
        priceLevel: 3,
        tags: [primaryVibe, primaryDateStyle, `BUDGET_${request.budget}`, request.transport],
        reason: 'Iconic skyline views for a date-night moment.',
      },
      {
        kind: 'PLACE' as const,
        name: 'Gardens by the Bay',
        lat: 1.2816,
        lng: 103.8636,
        address: '18 Marina Gardens Dr, Singapore 018953',
        url: 'https://www.gardensbythebay.com.sg/',
        rating: 4.8,
        reviewCount: 9800,
        priceLevel: 2,
        tags: [
          'SCENIC',
          ...request.food.map((selection) => `FOOD_${selection}`),
          ...request.avoid.map((selection) => `AVOID_${selection}`),
        ],
        reason: 'Scenic walk that reflects your selected food and avoid preferences.',
      },
    ];

    const legs = [
      { from: 0, to: 1, mode: 'TRANSIT' as const, durationMin: 20, distanceM: 6500 },
      { from: 1, to: 2, mode: 'WALK' as const, durationMin: 12, distanceM: 900 },
    ];

    const response = {
      itineraryId,
      stops,
      legs,
      totals: {
        durationMin: request.durationMin,
        walkingDistanceM: legs.filter((leg) => leg.mode === 'WALK').reduce((sum, leg) => sum + leg.distanceM, 0),
      },
      meta: {
        usedCache: false,
        warnings: ['Stub itinerary only. Real generation is not enabled in this environment.'],
      },
    };

    return GenerateItineraryResponseSchema.parse(response);
  }
}
