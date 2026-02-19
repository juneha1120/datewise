import { HttpException, HttpStatus, Logger } from '@nestjs/common';

const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_RETRIES = 2;

const logger = new Logger('HttpClient');

type RequestOptions = Omit<RequestInit, 'signal'>;

export async function fetchJsonWithRetry<T>(url: string, init?: RequestOptions): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`External places API failed with status ${response.status}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      logger.warn(`External call failed on attempt ${attempt + 1}: ${String(error)}`);
      if (attempt === MAX_RETRIES) {
        break;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new HttpException(
    {
      code: 'EXTERNAL_SERVICE_ERROR',
      message: 'Failed to fetch places data.',
      details: String(lastError),
    },
    HttpStatus.BAD_GATEWAY,
  );
}
