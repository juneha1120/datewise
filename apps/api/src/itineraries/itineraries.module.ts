import { Module } from '@nestjs/common';
import { ItinerariesController } from './itineraries.controller';
import { ItinerariesService } from './itineraries.service';
import { ScoringService } from './scoring.service';
import { PlacesService } from '../places/places.service';
import { TaggingService } from '../places/tagging.service';
import { ItineraryBuilder } from './itinerary-builder';

@Module({
  controllers: [ItinerariesController],
  providers: [ItinerariesService, ScoringService, ItineraryBuilder, PlacesService, TaggingService],
})
export class ItinerariesModule {}
