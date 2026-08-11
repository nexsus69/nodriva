import type { ResourceKind } from '@dashboard/core';
import { resourceReference } from '@dashboard/core';
import { AuthResolver } from '../app/actions/auth/AuthResolver';

/**
 * Serializes an administrative mutation on the same lock primitive used by
 * node/entity editing. The permission check deliberately happens before the
 * lock acquisition, so an unauthorized request cannot create lock noise.
 */
export async function withAdministrativeMutationLock<T>(options: {
  resourceType: Exclude<ResourceKind, 'node' | 'entity'>;
  resourceId: string;
  permission: string;
  work: (identity: { userId: string; sessionId: string }) => Promise<T>;
}): Promise<T> {
  const identity = await AuthResolver.resolveActorIdentity();
  const { accessControlPort, lockService } = await import('./db');
  await accessControlPort.assertHasPermission(identity.userId, options.permission, null);
  const reference = resourceReference(options.resourceType, options.resourceId);
  await lockService.lock(reference, identity.userId, identity.sessionId);
  try {
    return await options.work(identity);
  } finally {
    await lockService.unlock(reference, identity.userId, identity.sessionId).catch((error) => {
      console.error('[AdminMutationLock] Failed to release lock', {
        resourceType: options.resourceType,
        resourceId: options.resourceId,
        error,
      });
    });
  }
}
