'use server';

import { AuthResolver } from './auth/AuthResolver';

async function resolveMfaContext() {
  const userId = await AuthResolver.resolveActorUserId();
  const { mfaTotpService, userRepository } = await import('../../server/db');
  if (!mfaTotpService) throw new Error('MFA is not configured by the deployment operator.');
  const user = await userRepository.findById(userId);
  if (!user) throw new Error('Authenticated user not found.');
  return { userId, email: user.email, service: mfaTotpService };
}

export async function beginMfaEnrollmentAction(currentCode?: string) {
  const context = await resolveMfaContext();
  return context.service.beginEnrollment(context.userId, context.email, currentCode?.trim());
}

export async function confirmMfaEnrollmentAction(code: string) {
  const context = await resolveMfaContext();
  return { recoveryCodes: await context.service.confirmEnrollment(context.userId, code.trim()) };
}

export async function disableMfaAction(code: string) {
  const context = await resolveMfaContext();
  await context.service.disable(context.userId, code.trim());
  return { success: true };
}
