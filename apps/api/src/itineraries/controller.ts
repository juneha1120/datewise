import { Body, Controller, Get, Headers, Param, Post, UnauthorizedException } from '@nestjs/common';
import { type GenerateItineraryInput, type ItinerarySlot, type RegenerateSlotInput } from '@datewise/shared';
import { AuthService } from '../auth/service';
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
  async save(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { input: GenerateItineraryInput; result: ItinerarySlot[]; isPublic: boolean },
  ) {
    const userId = await this.userIdFromHeader(authorization);
    return this.generator.saveGenerated(userId, body.input, body.result, body.isPublic);
  }

  @Get('mine')
  async mine(@Headers('authorization') authorization: string | undefined) {
    const userId = await this.userIdFromHeader(authorization);
    return this.generator.listMine(userId);
  }

  @Get('public')
  async publicList() {
    return this.generator.listPublic();
  }

  @Post('public/:id/save-copy')
  async savePublicCopy(@Headers('authorization') authorization: string | undefined, @Param('id') id: string) {
    const userId = await this.userIdFromHeader(authorization);
    return this.generator.savePublicCopy(userId, id);
  }

  @Get('saved/mine')
  async mySaved(@Headers('authorization') authorization: string | undefined) {
    const userId = await this.userIdFromHeader(authorization);
    return this.generator.listSaved(userId);
  }
}
