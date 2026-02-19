import { NextRequest, NextResponse } from 'next/server';
import { PlacesAutocompleteQuerySchema } from '@datewise/shared';
import { proxyToApi } from '../shared';

export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const q = request.nextUrl.searchParams.get('q') ?? '';
  const parsed = PlacesAutocompleteQuerySchema.safeParse({ q });

  if (!parsed.success) {
    return NextResponse.json(
      {
        code: 'INVALID_PLACES_AUTOCOMPLETE_QUERY',
        message: 'Invalid places autocomplete query parameters',
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  return proxyToApi(request, `/v1/places/autocomplete?q=${encodeURIComponent(parsed.data.q)}`);
}
