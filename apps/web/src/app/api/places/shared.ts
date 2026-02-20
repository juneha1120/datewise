import { NextRequest, NextResponse } from 'next/server';

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/u, '');
}

function getBaseUrlCandidates(): string[] {
  const configuredServerUrl = process.env.API_INTERNAL_BASE_URL?.trim();
  const configuredPublicUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

  const candidates = [
    configuredServerUrl,
    configuredPublicUrl,
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://[::1]:3001',
    'http://host.docker.internal:3001',
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => normalizeBaseUrl(value));

  return [...new Set(candidates)];
}

type ProxyOptions = {
  method?: 'GET' | 'POST';
};

export async function proxyToApi(request: NextRequest, path: string, options: ProxyOptions = {}): Promise<NextResponse> {
  let lastError: unknown;
  const method = options.method ?? request.method;

  const requestBody = method === 'POST' ? JSON.stringify(await request.json()) : undefined;

  for (const baseUrl of getBaseUrlCandidates()) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        cache: 'no-store',
        headers: method === 'POST' ? { 'content-type': 'application/json' } : undefined,
        body: requestBody,
      });
      const body = (await response.json()) as unknown;
      return NextResponse.json(body, { status: response.status });
    } catch (error) {
      lastError = error;
    }
  }

  return NextResponse.json(
    {
      code: 'UPSTREAM_UNREACHABLE',
      message: 'Unable to reach API from web server.',
      details: String(lastError ?? 'Unknown upstream error'),
      triedBaseUrls: getBaseUrlCandidates(),
    },
    { status: 502 },
  );
}
