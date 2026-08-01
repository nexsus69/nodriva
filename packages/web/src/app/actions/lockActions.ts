'use server';

import { AppError } from '@dashboard/core';
import { AuthResolver } from './auth/AuthResolver';
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

function mapLockError(error: unknown, fallback: string) {
  if (error instanceof AppError) {
    return { success: false as const, error: error.code, message: error.message };
  }
  if (error instanceof Error) {
    return { success: false as const, error: 'INVALID_REQUEST', message: error.message };
  }
  return { success: false as const, error: 'INTERNAL_ERROR', message: fallback };
}

export async function acquireLockAction(resourceType: string, resourceId: string) {
  try {
    const actor = await resolveAuthorizedActor(resourceType, resourceId);
    const { lockService } = await import('../../server/db');
    const lock = await lockService.lock(actor.resourceType, resourceId, actor.actorUserId);
    return { success: true as const, lock: { id: lock.id, expiresAt: lock.expiresAt.toISOString() } };
  } catch (error) {
    console.error('[LockActions] Failed to acquire lock:', error);
    return mapLockError(error, 'Failed to acquire lock.');
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
    return mapLockError(error, 'Failed to refresh lock.');
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
    return mapLockError(error, 'Failed to release lock.');
  }
}

export async function isLockedAction(resourceType: string, resourceId: string) {
  try {
    const actor = await resolveAuthorizedActor(resourceType, resourceId);
    const { lockService } = await import('../../server/db');
    return await lockService.isLocked(actor.resourceType, resourceId);
  } catch (error) {
    console.error('[LockActions] Failed to check lock:', error);
    return { locked: false };
  }
}
