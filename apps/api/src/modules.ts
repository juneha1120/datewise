import { Module } from '@nestjs/common';
import { AuthController } from './auth/controller';
import { AuthService } from './auth/service';
import { ItinerariesController } from './itineraries/controller';
import { GeneratorService } from './itineraries/generator.service';
import { ScoringService } from './itineraries/scoring.service';
import { PlacesProvider } from './places/provider';

@Module({
  controllers: [AuthController, ItinerariesController],
  providers: [AuthService, GeneratorService, ScoringService, PlacesProvider],
})
export class AppModule {}
