import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { AppController } from './app.controller';

test('/health returns status payload', () => {
  const controller = new AppController();
  const response = controller.health();

  assert.deepStrictEqual(response, {
    service: 'datewise-api',
    status: 'ok',
  });
});
