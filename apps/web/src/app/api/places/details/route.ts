import { NextRequest, NextResponse } from 'next/server';
import { PlaceDetailsQuerySchema } from '@datewise/shared';
import { proxyToApi } from '../shared';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const placeId = request.nextUrl.searchParams.get('placeId') ?? '';
  const parsed = PlaceDetailsQuerySchema.safeParse({ placeId });

  if (!parsed.success) {
    return NextResponse.json(
      {
        code: 'INVALID_PLACE_DETAILS_QUERY',
        message: 'Invalid place details query parameters',
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  return proxyToApi(`/v1/places/details?placeId=${encodeURIComponent(parsed.data.placeId)}`);
}
