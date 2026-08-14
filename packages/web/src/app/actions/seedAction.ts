'use server';

import { AuthResolver } from './auth/AuthResolver';

export async function checkDatabaseSeededAction() {
  await AuthResolver.resolveActorUserId();
  const { systemSeedService } = await import('../../server/db');
  return await systemSeedService.checkSeeded();
}

const SEED_CONFIRMATION = 'INITIALIZE SYSTEM';

export async function seedDatabaseAction(confirmation: string) {
  if (confirmation !== SEED_CONFIRMATION) {
    throw new Error(`Type ${SEED_CONFIRMATION} to confirm the administrative bootstrap.`);
  }
  const actorUserId = await AuthResolver.resolveActorUserId();
  const { systemSeedService, accessControlPort } = await import('../../server/db');
  await accessControlPort.assertIsSuperAdmin(actorUserId);
  await systemSeedService.seedDatabase();
  return { success: true };
}
