'use server';

import { AuthResolver } from './auth/AuthResolver';
import { mapAppErrorToApiErrorResponse } from './errorMapping';

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
