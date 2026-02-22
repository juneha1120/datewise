declare const test: (name: string, fn: () => void | Promise<void>) => void;
import * as assert from 'assert/strict';
import { BadRequestException } from '@nestjs/common';
import { ItinerariesController } from './itineraries.controller';
import { ItinerariesService } from './itineraries.service';

test('generate throws BadRequestException with mapped errors for invalid payload', async () => {
  const service = new ItinerariesService();
  const controller = new ItinerariesController(service);

  await assert.rejects(
    async () =>
      controller.generate({
        date: '2026/01/01',
      }),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      if (!(error instanceof BadRequestException)) {
        return false;
      }

      const response = error.getResponse() as {
        message: string;
        errors: Array<{ path: string; message: string }>;
      };

      assert.equal(response.message, 'Validation failed');
      assert.ok(response.errors.some((issue) => issue.path === 'origin'));
      return true;
    },
  );
});
