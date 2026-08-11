'use server';

import { AuthResolver } from './auth/AuthResolver';
import { mapAppErrorToApiErrorResponse } from './errorMapping';
import {
  getRealtimeDataChannelName,
  getRealtimeLockChannelName,
} from '@dashboard/core';

export async function listRealtimeScopeAssignmentsAction() {
  try {
    const userId = await AuthResolver.resolveActorUserId();
    const { securityRepository } = await import('../../server/db');
    return {
      success: true as const,
      data: await securityRepository.listRealtimeScopeAssignments(userId),
    };
  } catch (error) {
    return { success: false as const, error: mapAppErrorToApiErrorResponse(error) };
  }
}

export async function listVirtualRootNodeIdsAction() {
  try {
    const userId = await AuthResolver.resolveActorUserId();
    const { securityRepository } = await import('../../server/db');
    return {
      success: true as const,
      data: await securityRepository.listRealtimeVirtualRootNodeIds(userId),
    };
  } catch (error) {
    return { success: false as const, error: mapAppErrorToApiErrorResponse(error) };
  }
}

export async function listRealtimeChannelsAction() {
  try {
    const userId = await AuthResolver.resolveActorUserId();
    const { securityRepository, isRealtimeCapabilityEnabled } = await import('../../server/db');
    if (!(await isRealtimeCapabilityEnabled())) {
      return { success: true as const, data: { dataChannels: [], lockChannels: [] } };
    }
    const policies = await securityRepository.listRealtimeChannelPoliciesForUser(userId);
    return {
      success: true as const,
      data: {
        dataChannels: policies.map(getRealtimeDataChannelName),
        lockChannels: policies.map(getRealtimeLockChannelName),
      },
    };
  } catch (error) {
    return { success: false as const, error: mapAppErrorToApiErrorResponse(error) };
  }
}
