'use server';

/** Runs the guarded, idempotent administrative bootstrap for an empty deployment. */
import { AuthResolver } from './auth/AuthResolver';
import { mapAppErrorToApiErrorResponse } from './errorMapping';
import type { ApiErrorResponse } from '@dashboard/core';

type SeedActionResult =
  | { success: true }
  | { success: false; error: ApiErrorResponse };

export async function checkDatabaseSeededAction() {
  await AuthResolver.resolveActorUserId();
  const { systemSeedService } = await import('../../server/db');
  return await systemSeedService.checkSeeded();
}

const SEED_CONFIRMATION = 'INITIALIZE SYSTEM';

export async function seedDatabaseAction(confirmation: string): Promise<SeedActionResult> {
  if (confirmation !== SEED_CONFIRMATION) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: `Type ${SEED_CONFIRMATION} to confirm the administrative bootstrap.` },
    };
  }
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    const { systemSeedService, accessControlPort } = await import('../../server/db');
    await accessControlPort.assertIsSuperAdmin(actorUserId);
    await systemSeedService.seedDatabase();
    return { success: true };
  } catch (error) {
    return { success: false, error: mapAppErrorToApiErrorResponse(error) };
  }
}
