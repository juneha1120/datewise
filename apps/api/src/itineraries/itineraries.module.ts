import { Module } from '@nestjs/common';
import { ItinerariesController } from './itineraries.controller';
import { ItinerariesService } from './itineraries.service';
import { ScoringService } from './scoring.service';
import { PlacesService } from '../places/places.service';
import { ItineraryBuilder } from './itinerary-builder';
import { DirectionsService } from './directions.service';

@Module({
  controllers: [ItinerariesController],
  providers: [ItinerariesService, ScoringService, ItineraryBuilder, DirectionsService, PlacesService],
})
export class ItinerariesModule {}
