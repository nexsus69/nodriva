import { NextRequest, NextResponse } from 'next/server';
import { drainRealtimeOutbox } from '../../../../../server/realtime';

export async function POST(request: NextRequest) {
  const secret = process.env.REALTIME_WORKER_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const delivered = await drainRealtimeOutbox(100);
  return NextResponse.json({ delivered });
}
