'use server';

import { signOut } from '../../auth';
import { AuthResolver } from './auth/AuthResolver';
import { mapAppErrorToApiErrorResponse } from './errorMapping';

/** Changes only the authenticated account password; the target identity never comes from the client. */
export async function changeCurrentPasswordAction(currentPassword: string, newPassword: string) {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    const { currentAccountService } = await import('../../server/db');
    await currentAccountService.changePassword(actorUserId, currentPassword, newPassword);
    await signOut({ redirect: false });
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: mapAppErrorToApiErrorResponse(error) };
  }
}
