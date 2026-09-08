/** Authenticates the internal worker and drains durable delivery queues. */
import { NextRequest, NextResponse } from 'next/server';
import { drainRealtimeOutbox } from '../../../../../server/realtime';
import { attachmentCleanupService } from '../../../../../server/db';

export async function POST(request: NextRequest) {
  const secret = process.env.REALTIME_WORKER_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const delivered = await drainRealtimeOutbox(100);
  const attachmentsProcessed = await attachmentCleanupService.drain(100);
  return NextResponse.json({ delivered, attachmentsProcessed });
}
