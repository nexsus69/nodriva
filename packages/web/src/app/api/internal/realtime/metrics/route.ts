import { NextRequest, NextResponse } from 'next/server';
import { realtimeMetrics, realtimeOutbox } from '../../../../../server/db';

export async function GET(request: NextRequest) {
  const secret = process.env.REALTIME_WORKER_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  return new NextResponse(realtimeMetrics.toPrometheus(await realtimeOutbox.getOperationalStats()), {
    headers: { 'content-type': 'text/plain; version=0.0.4; charset=utf-8' },
  });
}
