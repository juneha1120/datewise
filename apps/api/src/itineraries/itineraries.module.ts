import { Module } from '@nestjs/common';
import { ItinerariesController } from './itineraries.controller';
import { ItinerariesService } from './itineraries.service';
import { ScoringService } from './scoring.service';

@Module({
  controllers: [ItinerariesController],
  providers: [ItinerariesService, ScoringService],
})
export class ItinerariesModule {}
