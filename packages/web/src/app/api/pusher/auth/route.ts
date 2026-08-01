import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import PusherServer from 'pusher';
import { AppError } from '@dashboard/core';

const LOCK_CHANNEL_PATTERN =
  /^private-locks-(node|entity)-([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

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

    const match = LOCK_CHANNEL_PATTERN.exec(channelValue);
    if (!match) {
      return new NextResponse('Invalid channel', { status: 400 });
    }

    const resourceType = match[1] as 'node' | 'entity';
    const resourceId = match[2]!;
    const { accessControlPort, lockService } = await import('../../../../server/db');

    if (resourceType === 'node') {
      await accessControlPort.assertHasPermission(userId, 'node.edit', resourceId);
    } else {
      await accessControlPort.assertCanEditEntity(userId, resourceId);
    }

    const lockState = await lockService.isLocked(resourceType, resourceId);
    if (!lockState.locked || lockState.byUserId !== userId) {
      return new NextResponse('Active owned lock required', { status: 403 });
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
