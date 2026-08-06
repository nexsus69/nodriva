import {
  AppError,
  getRealtimeDataChannelName,
  getRealtimeLockChannelName,
} from '@dashboard/core';
import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';

export const GET = auth(async (request) => {
  const userId = request.auth?.userId;
  if (!userId) return NextResponse.json({ error: 'SESSION_EXPIRED' }, { status: 401 });

  try {
    const { securityRepository } = await import('../../../../server/db');
    const [policies, virtualRootNodeIds] = await Promise.all([
      process.env.NEXT_PUBLIC_REALTIME_ENABLED === 'false'
        ? Promise.resolve([])
        : securityRepository.listRealtimeChannelPoliciesForUser(userId),
      securityRepository.listRealtimeVirtualRootNodeIds(userId),
    ]);
    return NextResponse.json({
      dataChannels: policies.map(getRealtimeDataChannelName),
      lockChannels: policies.map(getRealtimeLockChannelName),
      virtualRootNodeIds,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof AppError) {
      const status = error.code === 'AUTH_UNAUTHORIZED' ? 401 : 403;
      return NextResponse.json({ error: error.code }, { status });
    }
    console.error('[PassiveSync] Unexpected error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});
