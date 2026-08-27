/** Exposes durable workflow backlog metrics to the authenticated deployment collector. */
import { NextRequest, NextResponse } from 'next/server';
import { workflowRepository } from '../../../../../server/db';
import { workflowStatsToPrometheus } from '../../../../../server/WorkflowMetrics';

export async function GET(request: NextRequest) {
  const secret = process.env.REALTIME_WORKER_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  return new NextResponse(workflowStatsToPrometheus(await workflowRepository.getOperationalStats()), {
    headers: { 'content-type': 'text/plain; version=0.0.4; charset=utf-8' },
  });
}
