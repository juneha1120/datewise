import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadApiEnvironment } from './env';

loadApiEnvironment();


async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(3001, '0.0.0.0');
}

void bootstrap();
