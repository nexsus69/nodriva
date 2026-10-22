/** Exposes operational readiness probes to host, reverse proxy or orchestrator health checkers. */
import { NextResponse } from 'next/server';
import { serviceHealthCheckService } from '../../../server/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const dbCheck = await serviceHealthCheckService.check('database');
    const isReady = dbCheck.status === 'healthy';
    const status = isReady ? 200 : 503;
    return NextResponse.json(
      {
        status: isReady ? 'ready' : 'unhealthy',
        database: {
          status: dbCheck.status,
          provider: dbCheck.providerKey,
          latencyMs: dbCheck.latencyMs,
          ...(dbCheck.message ? { message: dbCheck.message } : {}),
        },
      },
      {
        status,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Readiness check failed',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
    );
  }
}
