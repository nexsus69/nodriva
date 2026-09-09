'use server';

/** Completes one-time account actions with safe, contextual error responses. */

import type { AccountActionPurpose } from '@dashboard/core';
import { AuthResolver } from './auth/AuthResolver';
import { mapAppErrorToApiErrorResponse } from './errorMapping';

export async function issueAccountActionAction(userId: string, purpose: AccountActionPurpose) {
  const actorUserId = await AuthResolver.resolveActorUserId();
  const { accountRecoveryService } = await import('../../server/db');
  const result = await accountRecoveryService.issue(actorUserId, userId, purpose);
  return { expiresAt: result.expiresAt.toISOString() };
}

export async function completeAccountActionAction(token: string, password: string) {
  try {
    const { accountRecoveryService } = await import('../../server/db');
    await accountRecoveryService.complete(token, password);
    return { success: true as const };
  } catch (error) {
    const mapped = mapAppErrorToApiErrorResponse(error, 'account-completion');
    return { success: false as const, error: mapped.message };
  }
}
