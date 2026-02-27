import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('/health')
  health() {
    return {
      service: 'datewise-api',
      status: 'ok',
    };
  }
}
