import { NextRequest, NextResponse } from 'next/server';

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/u, '');
}

function deriveRequestBaseUrl(request: NextRequest): string | null {
  const host = request.headers.get('host')?.trim();
  if (!host) {
    return null;
  }

  const protocol = request.headers.get('x-forwarded-proto')?.trim() || request.nextUrl.protocol.replace(/:$/u, '');
  const url = new URL(`${protocol}://${host}`);
  url.port = '3001';
  return normalizeBaseUrl(url.toString());
}

function getBaseUrlCandidates(request: NextRequest): string[] {
  const configuredServerUrl = process.env.API_INTERNAL_BASE_URL?.trim();
  const configuredPublicUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const requestDerivedUrl = deriveRequestBaseUrl(request);

  const candidates = [
    configuredServerUrl,
    configuredPublicUrl,
    requestDerivedUrl,
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://host.docker.internal:3001',
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => normalizeBaseUrl(value));

  return [...new Set(candidates)];
}

export async function proxyToApi(request: NextRequest, path: string): Promise<NextResponse> {
  let lastError: unknown;

  for (const baseUrl of getBaseUrlCandidates(request)) {
    try {
      const response = await fetch(`${baseUrl}${path}`, { cache: 'no-store' });
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
      triedBaseUrls: getBaseUrlCandidates(request),
    },
    { status: 502 },
  );
}
