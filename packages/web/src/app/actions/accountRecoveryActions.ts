'use server';

import type { AccountActionPurpose } from '@dashboard/core';
import { AuthResolver } from './auth/AuthResolver';

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
    const message = error instanceof Error && error.message === 'Invalid password.'
      ? error.message
      : 'Il link non è valido, è scaduto o è già stato utilizzato.';
    return { success: false as const, error: message };
  }
}
