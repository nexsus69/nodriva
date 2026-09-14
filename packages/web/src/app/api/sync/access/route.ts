/** Returns authenticated realtime authorization and server stream checkpoints for one browser session. */
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
    const {
      securityRepository,
      isRealtimeCapabilityEnabled,
      realtimeChannelStreams,
    } = await import('../../../../server/db');
    const realtimeEnabled = await isRealtimeCapabilityEnabled();
    const [policies, virtualRootNodeIds] = await Promise.all([
      !realtimeEnabled
        ? Promise.resolve([])
        : securityRepository.listRealtimeChannelPoliciesForUser(userId),
      securityRepository.listRealtimeVirtualRootNodeIds(userId),
    ]);
    const dataChannels = policies.map(getRealtimeDataChannelName);
    return NextResponse.json({
      dataChannels,
      lockChannels: policies.map(getRealtimeLockChannelName),
      realtimeCheckpoints: realtimeEnabled
        ? realtimeChannelStreams.checkpoints(dataChannels)
        : [],
      virtualRootNodeIds,
      realtimeEnabled,
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
