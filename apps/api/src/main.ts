import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppController } from './app.controller';
import { ItinerariesController } from './itineraries/itineraries.controller';
import { DirectionsService } from './itineraries/directions.service';
import { ItinerariesService } from './itineraries/itineraries.service';
import { ScoringService } from './itineraries/scoring.service';
import { PlacesController } from './places/places.controller';
import { PlacesService } from './places/places.service';
import { loadApiEnvironment } from './env';

loadApiEnvironment();

@Module({
  controllers: [AppController, PlacesController, ItinerariesController],
  providers: [PlacesService, DirectionsService, ScoringService, ItinerariesService],
})
class RootModule {}

async function bootstrap() {
  const app = await NestFactory.create(RootModule);
  app.enableCors();
  await app.listen(3001, '0.0.0.0');
}

void bootstrap();
