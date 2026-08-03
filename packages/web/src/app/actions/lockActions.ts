'use server';

import { ApiErrorResponse } from '@dashboard/core';
import { AuthResolver } from './auth/AuthResolver';
import { mapAppErrorToApiErrorResponse } from './errorMapping';
import {
  LockResourceType,
  validateLockResource,
} from './lockResourceValidation';

async function resolveAuthorizedActor(
  resourceType: string,
  resourceId: string
): Promise<{ actorUserId: string; resourceType: LockResourceType }> {
  const validatedType = validateLockResource(resourceType, resourceId);
  const actorUserId = await AuthResolver.resolveActorUserId();
  const { accessControlPort } = await import('../../server/db');

  if (validatedType === 'node') {
    await accessControlPort.assertHasPermission(actorUserId, 'node.edit', resourceId);
  } else {
    await accessControlPort.assertCanEditEntity(actorUserId, resourceId);
  }

  return { actorUserId, resourceType: validatedType };
}

function mapLockError(error: unknown) {
  const mapped = mapAppErrorToApiErrorResponse(error);
  return { success: false as const, error: mapped.code, message: mapped.message, details: mapped };
}

export async function acquireLockAction(resourceType: string, resourceId: string) {
  try {
    const actor = await resolveAuthorizedActor(resourceType, resourceId);
    const { lockService } = await import('../../server/db');
    const lock = await lockService.lock(actor.resourceType, resourceId, actor.actorUserId);
    return { success: true as const, lock: { id: lock.id, expiresAt: lock.expiresAt.toISOString() } };
  } catch (error) {
    console.error('[LockActions] Failed to acquire lock:', error);
    return mapLockError(error);
  }
}

export async function refreshLockAction(resourceType: string, resourceId: string) {
  try {
    const actor = await resolveAuthorizedActor(resourceType, resourceId);
    const { lockService } = await import('../../server/db');
    const lock = await lockService.refresh(actor.resourceType, resourceId, actor.actorUserId);
    return { success: true as const, lock: { id: lock.id, expiresAt: lock.expiresAt.toISOString() } };
  } catch (error) {
    console.error('[LockActions] Failed to refresh lock:', error);
    return mapLockError(error);
  }
}

export async function releaseLockAction(resourceType: string, resourceId: string) {
  try {
    const actor = await resolveAuthorizedActor(resourceType, resourceId);
    const { lockService } = await import('../../server/db');
    await lockService.unlock(actor.resourceType, resourceId, actor.actorUserId);
    return { success: true as const };
  } catch (error) {
    console.error('[LockActions] Failed to release lock:', error);
    return mapLockError(error);
  }
}

export async function isLockedAction(resourceType: string, resourceId: string) {
  try {
    const actor = await resolveAuthorizedActor(resourceType, resourceId);
    const { lockService } = await import('../../server/db');
    return await lockService.isLocked(actor.resourceType, resourceId);
  } catch (error) {
    console.error('[LockActions] Failed to check lock:', error);
    return { locked: false, error: mapAppErrorToApiErrorResponse(error) as ApiErrorResponse };
  }
}

/** Read-only lock snapshot used by the client cache. */
export async function getLockStateAction(resourceType: string, resourceId: string) {
  try {
    const validatedType = validateLockResource(resourceType, resourceId);
    const actorUserId = await AuthResolver.resolveActorUserId();
    const { accessControlPort, lockService, entityRepository } = await import('../../server/db');

    if (validatedType === 'node') {
      await accessControlPort.assertCanReadNode(actorUserId, resourceId);
    } else {
      const entity = await entityRepository.findById(resourceId);
      if (!entity || entity.deletedAt) {
        return { locked: false as const };
      }
      await accessControlPort.assertCanReadNode(actorUserId, entity.parentNodeId);
    }

    return await lockService.isLocked(validatedType, resourceId);
  } catch (error) {
    console.error('[LockActions] Failed to read lock state:', error);
    return { locked: false as const, error: mapAppErrorToApiErrorResponse(error) as ApiErrorResponse };
  }
}
