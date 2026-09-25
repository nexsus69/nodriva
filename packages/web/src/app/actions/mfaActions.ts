'use server';

/** Exposes MFA mutations as safe, typed action outcomes. */

import { AuthResolver } from './auth/AuthResolver';
import { mapAppErrorToApiErrorResponse } from './errorMapping';

async function resolveMfaContext() {
  const userId = await AuthResolver.resolveActorUserId();
  const { mfaTotpService, userRepository } = await import('../../server/db');
  if (!mfaTotpService) throw new Error('MFA is not configured by the deployment operator.');
  const user = await userRepository.findById(userId);
  if (!user) throw new Error('Authenticated user not found.');
  return { userId, email: user.email, service: mfaTotpService };
}

export async function beginMfaEnrollmentAction(currentCode?: string) {
  try {
    const context = await resolveMfaContext();
    return { success: true as const, data: await context.service.beginEnrollment(context.userId, context.email, currentCode?.trim()) };
  } catch (error) {
    return { success: false as const, error: mapAppErrorToApiErrorResponse(error) };
  }
}

export async function confirmMfaEnrollmentAction(code: string) {
  try {
    const context = await resolveMfaContext();
    return { success: true as const, data: { recoveryCodes: await context.service.confirmEnrollment(context.userId, code.trim()) } };
  } catch (error) {
    return { success: false as const, error: mapAppErrorToApiErrorResponse(error) };
  }
}

export async function disableMfaAction(code: string) {
  try {
    const context = await resolveMfaContext();
    await context.service.disable(context.userId, code.trim());
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: mapAppErrorToApiErrorResponse(error) };
  }
}
