import { createHash } from 'node:crypto';
import type { ResourceKind } from '@dashboard/core';
import { resourceReference } from '@dashboard/core';
import { AuthResolver } from '../app/actions/auth/AuthResolver';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Keeps text-key administrative locks stable while satisfying audit UUID storage. */
export function administrativeLockResourceId(resourceType: string, resourceId: string): string {
  if (UUID_PATTERN.test(resourceId)) return resourceId;
  const chars = createHash('sha256').update(`${resourceType}:${resourceId}`).digest('hex').slice(0, 32).split('');
  chars[12] = '5';
  chars[16] = ['8', '9', 'a', 'b'][parseInt(chars[16], 16) % 4];
  const value = chars.join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

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
  const reference = resourceReference(options.resourceType, administrativeLockResourceId(options.resourceType, options.resourceId));
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
