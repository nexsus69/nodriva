/** Accepts bounded attachment-cleanup drains from the deployment worker only. */
import { NextRequest, NextResponse } from 'next/server';
import { attachmentCleanupService } from '../../../../../server/db';

export async function POST(request: NextRequest) {
  const secret = process.env.REALTIME_WORKER_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new NextResponse('Unauthorized', { status: 401 });
  return NextResponse.json({ processed: await attachmentCleanupService.drain(100) });
}
