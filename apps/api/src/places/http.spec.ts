import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { HttpException, HttpStatus } from '@nestjs/common';
import { fetchJsonWithRetry } from './http';

test('fetchJsonWithRetry retries transient errors and eventually returns JSON', async () => {
  const originalFetch = global.fetch;
  let callCount = 0;

  global.fetch = (async () => {
    callCount += 1;
    if (callCount === 1) {
      throw new Error('network blip');
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  try {
    const result = await fetchJsonWithRetry<{ ok: boolean }>('https://example.com/data');
    assert.deepStrictEqual(result, { ok: true });
    assert.equal(callCount, 2);
  } finally {
    global.fetch = originalFetch;
  }
});

test('fetchJsonWithRetry maps exhausted retries to BAD_GATEWAY HttpException', async () => {
  const originalFetch = global.fetch;
  global.fetch = (async () => {
    throw new Error('network down');
  }) as typeof fetch;

  try {
    await assert.rejects(
      async () => fetchJsonWithRetry('https://example.com/data'),
      (error: unknown) => {
        assert.ok(error instanceof HttpException);
        if (!(error instanceof HttpException)) {
          return false;
        }

        assert.equal(error.getStatus(), HttpStatus.BAD_GATEWAY);
        assert.equal((error.getResponse() as Record<string, unknown>).code, 'EXTERNAL_SERVICE_ERROR');
        return true;
      },
    );
  } finally {
    global.fetch = originalFetch;
  }
});
