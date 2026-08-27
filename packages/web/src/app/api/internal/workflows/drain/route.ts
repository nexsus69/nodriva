/** Accepts bounded internal workflow drains from the deployment worker only. */
import { NextRequest, NextResponse } from 'next/server';
import { drainWorkflowSteps } from '../../../../../server/workflow';

export async function POST(request: NextRequest) {
  const secret = process.env.REALTIME_WORKER_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const result = await drainWorkflowSteps(100);
  return NextResponse.json(result);
}
