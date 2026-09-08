/** Accepts bounded account-action delivery drains from the deployment worker. */
import { NextRequest, NextResponse } from 'next/server';
import { drainAccountActionDeliveryOutbox } from '../../../../../server/accountActionDelivery';

export async function POST(request: NextRequest) {
  const secret = process.env.REALTIME_WORKER_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const delivered = await drainAccountActionDeliveryOutbox(100);
  return NextResponse.json({ delivered });
}
