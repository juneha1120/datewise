import { NextRequest, NextResponse } from 'next/server';
import { proxyToApi } from '../../places/shared';

export async function POST(request: NextRequest): Promise<NextResponse> {
  return proxyToApi(request, '/v1/itineraries/generate', { method: 'POST' });
}
