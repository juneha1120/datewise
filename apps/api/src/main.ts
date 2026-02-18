import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadApiEnvironment } from './env';

loadApiEnvironment();

if (!(process.env.MAPBOX_ACCESS_TOKEN || process.env.MAPBOX_ACCESS_KEY || process.env.MAPBOX_API_KEY)) {
  console.warn('[Datewise API] MAPBOX_ACCESS_TOKEN is not set. Set MAPBOX_ACCESS_TOKEN, MAPBOX_ACCESS_KEY, or MAPBOX_API_KEY in .env or apps/api/.env.');
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(3001);
}

void bootstrap();
