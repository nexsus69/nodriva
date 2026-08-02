'use server';

import { AuthResolver } from './auth/AuthResolver';

export async function checkDatabaseSeededAction() {
  await AuthResolver.resolveActorUserId();
  const { systemSeedService } = await import('../../server/db');
  return await systemSeedService.checkSeeded();
}

export async function seedDatabaseAction() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Database seeding is disabled in production.');
  }
  const actorUserId = await AuthResolver.resolveActorUserId();
  const { systemSeedService, accessControlPort } = await import('../../server/db');
  await accessControlPort.assertHasPermission(actorUserId, 'system.config', null);
  await systemSeedService.seedDatabase();
  return { success: true };
}
