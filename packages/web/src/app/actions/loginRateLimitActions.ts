'use server';

/** Exposes the narrow, audited source-address limiter controls to security administration. */
import type { ApiErrorResponse, LoginRateLimitStatus } from '@dashboard/core';
import { authApplicationService } from '../../server/db';
import { AuthResolver } from './auth/AuthResolver';
import { mapAppErrorToApiErrorResponse } from './errorMapping';

type ActionResult<T> = { success: true; data: T } | { success: false; error: ApiErrorResponse };

function invalidSourceAddress(): ActionResult<never> {
  return { success: false, error: { code: 'VALIDATION_ERROR', message: 'Inserisci un indirizzo IP valido.' } };
}

export async function getSourceLoginRateLimitAction(sourceAddress: unknown): Promise<ActionResult<LoginRateLimitStatus>> {
  if (typeof sourceAddress !== 'string') return invalidSourceAddress();
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    return { success: true, data: await authApplicationService.getSourceAddressRateLimitStatus(actorUserId, sourceAddress) };
  } catch (error) {
    return { success: false, error: mapAppErrorToApiErrorResponse(error) };
  }
}

export async function releaseSourceLoginRateLimitAction(sourceAddress: unknown): Promise<ActionResult<undefined>> {
  if (typeof sourceAddress !== 'string') return invalidSourceAddress();
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    await authApplicationService.releaseSourceAddressLoginRateLimit(actorUserId, sourceAddress);
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: mapAppErrorToApiErrorResponse(error) };
  }
}
