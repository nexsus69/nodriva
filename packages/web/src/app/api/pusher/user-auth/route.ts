import { NextResponse } from 'next/server';
import PusherServer from 'pusher';
import { auth } from '../../../../auth';

const pusher = new PusherServer({
  appId: process.env.PUSHER_APP_ID || '',
  key: process.env.NEXT_PUBLIC_PUSHER_KEY || '',
  secret: process.env.PUSHER_SECRET || '',
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || '',
  useTLS: process.env.NEXT_PUBLIC_PUSHER_SCHEME === 'https',
  host: process.env.NEXT_PUBLIC_PUSHER_HOST || undefined,
  port: process.env.NEXT_PUBLIC_PUSHER_PORT || undefined,
});

/** Enables forced disconnects after an ACL or account-state revocation. */
export const POST = auth(async (req) => {
  if (process.env.REALTIME_ENABLED === 'false') {
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
