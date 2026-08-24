'use server';

/** Provides validated server actions for resource editing locks. */
import { ApiErrorResponse, resourceReference } from '@dashboard/core';
import { AuthResolver } from './auth/AuthResolver';
import { mapAppErrorToApiErrorResponse } from './errorMapping';
import {
  LockResourceType,
  validateLockResource,
} from './lockResourceValidation';

async function resolveAuthorizedActor(
  resourceType: string,
  resourceId: string
): Promise<{ actorUserId: string; actorSessionId: string; resourceType: LockResourceType; scopeNodeId?: string }> {
  const validatedType = validateLockResource(resourceType, resourceId);
  const identity = await AuthResolver.resolveActorIdentity();
  const actorUserId = identity.userId;
  const { accessControlPort, entityRepository, securityRepository } = await import('../../server/db');

  if (validatedType === 'node') {
    await accessControlPort.assertHasPermission(actorUserId, 'node.edit', resourceId);
    return { actorUserId, actorSessionId: identity.sessionId, resourceType: validatedType, scopeNodeId: resourceId };
  } else if (validatedType === 'entity') {
    const entity = await entityRepository.findById(resourceId);
    if (!entity || entity.deletedAt) throw new Error('Entità non trovata.');
    await accessControlPort.assertHasPermission(actorUserId, 'entity.edit', entity.parentNodeId);
    return { actorUserId, actorSessionId: identity.sessionId, resourceType: validatedType, scopeNodeId: entity.parentNodeId };
  } else if (validatedType === 'scope_assignment') {
    const assignment = await securityRepository.getScopeAssignmentManageableBy(actorUserId, resourceId);
    if (!assignment) throw new Error('Scope assignment not found.');
    await accessControlPort.assertHasPermissionCoverage(actorUserId, 'scope.assign', assignment.nodeId, assignment.propagation);
    return { actorUserId, actorSessionId: identity.sessionId, resourceType: validatedType, scopeNodeId: assignment.nodeId };
  } else {
    const permission = validatedType === 'user' ? 'user.update'
      : validatedType === 'role' ? 'role.update'
      : validatedType === 'node_type' ? 'node_type.update'
      : validatedType === 'entity_type' ? 'entity_type.update'
      : 'system.config';
    await accessControlPort.assertHasPermission(actorUserId, permission, null);
    // Administrative resources are global and have no node scope. Do not use
    // an empty string: PostgreSQL audit columns represent node scope as UUID.
    return { actorUserId, actorSessionId: identity.sessionId, resourceType: validatedType };
  }
}

function mapLockError(error: unknown) {
  const mapped = mapAppErrorToApiErrorResponse(error);
  return { success: false as const, error: mapped.code, message: mapped.message, details: mapped };
}

export async function acquireLockAction(resourceType: string, resourceId: string) {
  try {
    const actor = await resolveAuthorizedActor(resourceType, resourceId);
    const { lockService } = await import('../../server/db');
    const lock = await lockService.lock(resourceReference(actor.resourceType, resourceId), actor.actorUserId, actor.actorSessionId, undefined, { scopeNodeId: actor.scopeNodeId });
    return { success: true as const, lock: { id: lock.id, sessionId: lock.sessionId, expiresAt: lock.expiresAt.toISOString() } };
  } catch (error) {
    console.error('[LockActions] Failed to acquire lock:', error);
    return mapLockError(error);
  }
}

export async function refreshLockAction(resourceType: string, resourceId: string) {
  try {
    const actor = await resolveAuthorizedActor(resourceType, resourceId);
    const { lockService } = await import('../../server/db');
    const lock = await lockService.refresh(resourceReference(actor.resourceType, resourceId), actor.actorUserId, actor.actorSessionId, undefined, { scopeNodeId: actor.scopeNodeId });
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
    await lockService.unlock(resourceReference(actor.resourceType, resourceId), actor.actorUserId, actor.actorSessionId, { scopeNodeId: actor.scopeNodeId });
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
    return await lockService.isLocked(resourceReference(actor.resourceType, resourceId));
  } catch (error) {
    console.error('[LockActions] Failed to check lock:', error);
    return { locked: false, error: mapAppErrorToApiErrorResponse(error) as ApiErrorResponse };
  }
}

/** Read-only lock snapshot used by the client cache. */
export async function getLockStateAction(resourceType: string, resourceId: string) {
  try {
    const validatedType = validateLockResource(resourceType, resourceId);
    const identity = await AuthResolver.resolveActorIdentity();
    const actorUserId = identity.userId;
    const { accessControlPort, lockService, entityRepository, securityRepository } = await import('../../server/db');

    if (validatedType === 'node') {
      await accessControlPort.assertCanReadNode(actorUserId, resourceId);
    } else if (validatedType === 'entity') {
      const entity = await entityRepository.findById(resourceId);
      if (!entity || entity.deletedAt) {
        return { locked: false as const };
      }
      await accessControlPort.assertHasPermission(actorUserId, 'entity.read', entity.parentNodeId);
    } else if (validatedType === 'scope_assignment') {
      const assignment = await securityRepository.getScopeAssignmentManageableBy(actorUserId, resourceId);
      if (!assignment) return { locked: false as const };
    } else {
      const permission = validatedType === 'user' ? 'user.read'
        : validatedType === 'role' ? 'role.read'
        : validatedType === 'node_type' ? 'node_type.read'
        : validatedType === 'entity_type' ? 'entity_type.read'
        : 'system.config.read';
      await accessControlPort.assertHasPermission(actorUserId, permission, null);
    }

    return await lockService.isLocked(resourceReference(validatedType, resourceId));
  } catch (error) {
    console.error('[LockActions] Failed to read lock state:', error);
    return { locked: false as const, error: mapAppErrorToApiErrorResponse(error) as ApiErrorResponse };
  }
}
