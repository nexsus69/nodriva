import { NextResponse } from 'next/server';
import PusherServer from 'pusher';
import { auth } from '../../../../auth';
import { getRealtimePusherConfiguration } from '../../../../server/EnvironmentServiceConfiguration';

const pusher = new PusherServer(getRealtimePusherConfiguration(process.env, 'public'));

/** Enables forced disconnects after an ACL or account-state revocation. */
export const POST = auth(async (req) => {
  const { isRealtimeCapabilityEnabled } = await import('../../../../server/db');
  if (!(await isRealtimeCapabilityEnabled())) {
    return new NextResponse('Realtime disabled', { status: 503 });
  }
  const userId = req.auth?.userId;
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const data = await req.formData();
    const socketId = data.get('socket_id');
    if (typeof socketId !== 'string' || socketId.length === 0) {
      return new NextResponse('Missing socket_id', { status: 400 });
    }
    return NextResponse.json(pusher.authenticateUser(socketId, { id: userId }));
  } catch (error) {
    console.error('[PusherUserAuth] Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
});
