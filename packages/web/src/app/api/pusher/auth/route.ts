import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import PusherServer from 'pusher';
import { AppError } from '@dashboard/core';

const LOCK_CHANNEL_PATTERN =
  /^private-locks-(node|entity)-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const REALTIME_CHANNEL_PATTERN =
  /^private-events-node-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const SCOPE_CHANNEL_PATTERN =
  /^private-scope-node-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(self|subtree)$/i;

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
  if (process.env.REALTIME_ENABLED === 'false') {
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

    const lockMatch = LOCK_CHANNEL_PATTERN.exec(channelValue);
    const realtimeMatch = REALTIME_CHANNEL_PATTERN.exec(channelValue);
    const scopeMatch = SCOPE_CHANNEL_PATTERN.exec(channelValue);
    if (!lockMatch && !realtimeMatch && !scopeMatch) {
      return new NextResponse('Invalid channel', { status: 400 });
    }

    const resourceType = lockMatch ? (lockMatch[1] as 'node' | 'entity') : 'node';
    const resourceId = lockMatch ? lockMatch[2]! : realtimeMatch![1]!;
    const { accessControlPort, entityRepository } = await import('../../../../server/db');

    if (scopeMatch) {
      const scopeNodeId = scopeMatch[1]!;
      const propagation = scopeMatch[2]!;
      const { securityRepository } = await import('../../../../server/db');
      const scopes = await securityRepository.listRealtimeScopeAssignments(userId);
      if (!scopes.some((scope) => scope.nodeId === scopeNodeId && scope.propagation === propagation)) {
        return new NextResponse('Forbidden', { status: 403 });
      }
      const authResponse = pusher.authorizeChannel(socketIdValue, channelValue);
      return NextResponse.json(authResponse);
    }

    if (lockMatch) {
      if (resourceType === 'node') {
        await accessControlPort.assertCanReadNode(userId, resourceId);
      } else {
        const entity = await entityRepository.findById(resourceId);
        if (!entity || entity.deletedAt) {
          return new NextResponse('Not found', { status: 404 });
        }
        await accessControlPort.assertCanReadNode(userId, entity.parentNodeId);
      }
    } else if (resourceType === 'node') {
      await accessControlPort.assertCanReadNode(userId, resourceId);
    } else {
      const entity = await entityRepository.findById(resourceId);
      if (!entity || entity.deletedAt) {
        return new NextResponse('Not found', { status: 404 });
      }
      await accessControlPort.assertCanReadNode(userId, entity.parentNodeId);
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
