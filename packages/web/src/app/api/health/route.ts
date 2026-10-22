/** Exposes lightweight liveness probes confirming the application process is running. */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    { status: 'healthy', uptimeSeconds: Math.floor(process.uptime()) },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
  );
}
