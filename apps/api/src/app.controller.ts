import { Controller, Get } from '@nestjs/common';
// import { VibeSchema } from '@datewise/shared';

@Controller()
export class AppController {
  @Get('/health')
  health() {
    return {
      service: 'datewise-api',
      status: 'ok',
      // supportedVibes: VibeSchema.options,
    };
  }
}
