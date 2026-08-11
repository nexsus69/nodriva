import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import PusherServer from 'pusher';
import { AppError, getRealtimeDataChannelName, getRealtimeLockChannelName } from '@dashboard/core';

const POLICY_CHANNEL_PATTERN =
  /^private-realtime-policy-([0-9a-f]{32})-(data|locks)$/i;

const pusher = new PusherServer({
  appId: process.env.PUSHER_APP_ID || '',
  key: process.env.NEXT_PUBLIC_PUSHER_KEY || '',
  secret: process.env.PUSHER_SECRET || '',
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || '',
  useTLS: process.env.NEXT_PUBLIC_PUSHER_SCHEME === 'https',
  host: process.env.NEXT_PUBLIC_PUSHER_HOST || undefined,
  port: process.env.NEXT_PUBLIC_PUSHER_PORT || undefined,
});

export const POST = auth(async (req) => {
  const { isRealtimeCapabilityEnabled } = await import('../../../../server/db');
  if (!(await isRealtimeCapabilityEnabled())) {
    return new NextResponse('Realtime disabled', { status: 503 });
  }

  const userId = req.auth?.userId;

  if (!userId) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const data = await req.formData();
    const socketIdValue = data.get('socket_id');
    const channelValue = data.get('channel_name');

    if (typeof socketIdValue !== 'string' || typeof channelValue !== 'string') {
      return new NextResponse('Missing parameters', { status: 400 });
    }

    const channelMatch = POLICY_CHANNEL_PATTERN.exec(channelValue);
    if (!channelMatch) {
      return new NextResponse('Invalid channel', { status: 400 });
    }

    const { securityRepository } = await import('../../../../server/db');
    const policies = await securityRepository.listRealtimeChannelPoliciesForUser(userId);
    const requestedChannel = channelMatch[2] === 'data'
      ? policies.map(getRealtimeDataChannelName)
      : policies.map(getRealtimeLockChannelName);
    if (!requestedChannel.includes(channelValue)) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const authResponse = pusher.authorizeChannel(socketIdValue, channelValue);
    return NextResponse.json(authResponse);
  } catch (error) {
    if (error instanceof AppError && error.code === 'ACCESS_FORBIDDEN') {
      return new NextResponse('Forbidden', { status: 403 });
    }
    console.error('[PusherAuth] Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
});
