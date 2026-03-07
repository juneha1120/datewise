import { Module } from '@nestjs/common';
import { AuthController } from './auth/controller';
import { AuthService } from './auth/service';
import { ItinerariesController } from './itineraries/controller';
import { GeneratorService } from './itineraries/generator.service';
import { PlacesProvider } from './places/provider';

@Module({ controllers: [AuthController, ItinerariesController], providers: [AuthService, GeneratorService, PlacesProvider] })
export class AppModule {}
