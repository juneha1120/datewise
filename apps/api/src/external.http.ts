export type ExternalHttpError = {
  provider: 'supabase';
  code: 'timeout' | 'http_error' | 'network_error';
  status?: number;
  message: string;
};

export async function fetchWithRetry(url: string, init: RequestInit, timeoutMs = 5000, retries = 2): Promise<Response> {
  let attempt = 0;
  let lastError: unknown;
  while (attempt <= retries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      return response;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      attempt += 1;
      if (attempt > retries) throw error;
    }
  }
  throw lastError;
}
