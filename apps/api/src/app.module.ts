import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PlacesController } from './places/places.controller';
import { PlacesService } from './places/places.service';
import { TaggingService } from './places/tagging.service';
import { ItinerariesModule } from './itineraries/itineraries.module';

@Module({
  imports: [ItinerariesModule],
  controllers: [AppController, PlacesController],
  providers: [PlacesService, TaggingService],
})
export class AppModule {}
