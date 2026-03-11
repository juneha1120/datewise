import { Body, Controller, Get, Headers, Param, Post, UnauthorizedException } from '@nestjs/common';
import { GenerateItineraryInput, RegenerateSlotInput } from '@datewise/shared';
import { randomUUID } from 'node:crypto';
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
  async generate(@Body() input: GenerateItineraryInput) {
    return this.generator.generate(input);
  }

  @Post('regenerate-slot')
  async regenerateSlot(@Body() input: RegenerateSlotInput) {
    return this.generator.regenerateSlot(input);
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

  @Post('public/:id/save-copy')
  async savePublicCopy(@Headers('authorization') authorization: string | undefined, @Param('id') id: string) {
    const userId = await this.userIdFromHeader(authorization);
    const source = db.itineraries.get(id);
    if (!source || !source.isPublic) throw new UnauthorizedException('Public itinerary not found');
    const saved = {
      id: randomUUID(),
      userId,
      sourceItineraryId: source.id,
      sourceUserId: source.userId,
      snapshot: { ...source, slots: source.slots.map((slot) => ({ ...slot })) },
      createdAt: new Date().toISOString(),
    };
    db.saved.set(saved.id, saved);
    return saved;
  }

  @Get('saved/mine')
  async mySaved(@Headers('authorization') authorization: string | undefined) {
    const userId = await this.userIdFromHeader(authorization);
    return [...db.saved.values()].filter((entry) => entry.userId === userId);
  }
}
