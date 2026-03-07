import { Body, Controller, Get, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { GenerateItineraryInput } from '@datewise/shared';
import { AuthService } from '../auth/service';
import { db } from '../db';
import { GeneratorService } from './generator.service';

@Controller('itineraries')
export class ItinerariesController {
  constructor(private readonly auth: AuthService, private readonly generator: GeneratorService) {}

  private async userIdFromHeader(authorization?: string): Promise<string> {
    const token = authorization?.replace('Bearer ', '');
    if (!token) throw new UnauthorizedException();
    const me = await this.auth.getMe(token);
    return me.id;
  }

  @Post('generate')
  async generate(@Headers('authorization') authorization: string | undefined, @Body() input: GenerateItineraryInput) {
    await this.userIdFromHeader(authorization);
    return this.generator.generate(input);
  }

  @Post('save')
  async save(@Headers('authorization') authorization: string | undefined, @Body() body: { input: GenerateItineraryInput; isPublic: boolean }) {
    const userId = await this.userIdFromHeader(authorization);
    return this.generator.saveGenerated(userId, body.input, body.isPublic);
  }

  @Get('mine')
  async mine(@Headers('authorization') authorization: string | undefined) {
    const userId = await this.userIdFromHeader(authorization);
    return [...db.itineraries.values()].filter((entry) => entry.userId === userId);
  }

  @Get('public')
  async publicList() {
    return [...db.itineraries.values()].filter((entry) => entry.isPublic);
  }
}
