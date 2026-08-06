'use server';

import { AuthResolver } from './auth/AuthResolver';

export async function checkDatabaseSeededAction() {
  await AuthResolver.resolveActorUserId();
  const { systemSeedService } = await import('../../server/db');
  return await systemSeedService.checkSeeded();
}

const SEED_CONFIRMATION = 'RESET DEMO DATABASE';

export async function seedDatabaseAction(confirmation: string) {
  if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DESTRUCTIVE_SEED !== 'true') {
    throw new Error('Database seeding is disabled. Set ALLOW_DESTRUCTIVE_SEED=true only in an isolated demo environment.');
  }
  if (confirmation !== SEED_CONFIRMATION) {
    throw new Error(`Type ${SEED_CONFIRMATION} to confirm destructive seeding.`);
  }
  const actorUserId = await AuthResolver.resolveActorUserId();
  const { systemSeedService, accessControlPort } = await import('../../server/db');
  await accessControlPort.assertIsSuperAdmin(actorUserId);
  await systemSeedService.seedDatabase();
  return { success: true };
}
