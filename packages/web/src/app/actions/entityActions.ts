'use server';

import { AuthResolver } from './auth/AuthResolver';
import { runWithRealtimeOutbox } from '../../server/realtime';
import { publishAuditRealtimeChange } from '../../server/adminRealtime';
import { mapAppErrorToApiErrorResponse, withSafeActionErrors } from './errorMapping';
import type { ApiErrorResponse } from '@dashboard/core';
interface CreateEntityActionInput {
  parentNodeId: string;
  entityTypeKey?: string;
  entityTypeId?: string;
  name: string;
  description?: string;
  payload?: Record<string, unknown>;
  payloadDelta?: Record<string, unknown>;
}

interface UpdateEntityActionInput {
  entityId?: string;
  id?: string;
  name?: string;
  description?: string;
  expectedRowVersion?: number;
  rowVersion?: number;
  payloadDelta?: Record<string, unknown>;
  payload?: Record<string, unknown>;
}

interface DeleteEntityActionInput {
  entityId?: string;
  id?: string;
  /** Detail forms send their observed version; resource menus resolve it server-side. */
  expectedRowVersion?: number;
}

type EntityMutationActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: ApiErrorResponse };

/**
 * Expected domain failures must cross the Server Action boundary as data.
 * Throwing them makes React render an RSC error response in production, which
 * hides the validation message from the client.
 */
async function entityMutationResult<T>(operation: () => Promise<T>): Promise<EntityMutationActionResult<T>> {
  try {
    return { success: true, data: await operation() };
  } catch (error) {
    return { success: false, error: mapAppErrorToApiErrorResponse(error) };
  }
}

export async function createEntityAction(input: CreateEntityActionInput) {
  return entityMutationResult(async () => {
  const { entityService } = await import('../../server/db');
  const entityTypeKey = input.entityTypeKey || input.entityTypeId;
  if (!entityTypeKey) {
    throw new Error('entityTypeKey is required');
  }
  const identity = await AuthResolver.resolveActorIdentity();
  const cmd = {
    actorUserId: identity.userId,
    actorSessionId: identity.sessionId,
    parentNodeId: input.parentNodeId,
    entityTypeKey,
    name: input.name,
    description: input.description,
    payload: input.payload || input.payloadDelta || {},
  };
  const e = await runWithRealtimeOutbox(
    () => entityService.createEntity(cmd),
    (created) => ({ resourceType: 'entity', resourceId: created.id, changeType: 'created', actorUserId: cmd.actorUserId, parentNodeId: created.parentNodeId, entityTypeId: created.entityTypeId, data: toEntityDto(created) })
  );
  const result = {
    id: e.id,
    entityTypeId: e.entityTypeId,
    parentNodeId: e.parentNodeId,
    name: e.name,
    description: e.description,
    rowVersion: e.rowVersion,
    createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : String(e.createdAt),
    updatedAt: e.updatedAt instanceof Date ? e.updatedAt.toISOString() : String(e.updatedAt),
    payload: e.payload || {},
  };
  await publishAuditRealtimeChange({ resourceType: 'entity', resourceId: e.id, changeType: 'created', actorUserId: cmd.actorUserId });
  return result;
  });
}

export async function updateEntityAction(input: UpdateEntityActionInput) {
  return entityMutationResult(async () => {
  const { entityService } = await import('../../server/db');
  const entityId = input.entityId || input.id;
  if (!entityId) {
    throw new Error('entityId is required');
  }
  const expectedRowVersion = input.expectedRowVersion ?? input.rowVersion;
  if (expectedRowVersion === undefined) {
    throw new Error('expectedRowVersion is required');
  }
  const identity = await AuthResolver.resolveActorIdentity();
  const cmd = {
    actorUserId: identity.userId,
    actorSessionId: identity.sessionId,
    entityId,
    name: input.name,
    description: input.description,
    expectedRowVersion,
    payloadDelta: input.payloadDelta || input.payload,
  };
  const e = await runWithRealtimeOutbox(
    () => entityService.updateEntity(cmd),
    (updated) => ({ resourceType: 'entity', resourceId: updated.id, changeType: 'updated', actorUserId: cmd.actorUserId, parentNodeId: updated.parentNodeId, entityTypeId: updated.entityTypeId, data: toEntityDto(updated) })
  );
  const result = {
    id: e.id,
    entityTypeId: e.entityTypeId,
    parentNodeId: e.parentNodeId,
    name: e.name,
    description: e.description,
    rowVersion: e.rowVersion,
    createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : String(e.createdAt),
    updatedAt: e.updatedAt instanceof Date ? e.updatedAt.toISOString() : String(e.updatedAt),
    payload: e.payload || {},
  };
  await publishAuditRealtimeChange({ resourceType: 'entity', resourceId: e.id, changeType: 'updated', actorUserId: cmd.actorUserId });
  return result;
  });
}

export async function deleteEntityAction(input: DeleteEntityActionInput) {
  return entityMutationResult(async () => {
  const { accessControlPort, entityService, lockService, runtimeConfigPort } = await import('../../server/db');
  const entityId = input.entityId || input.id;
  if (!entityId) {
    throw new Error('entityId is required');
  }
  const identity = await AuthResolver.resolveActorIdentity();
  const actorUserId = identity.userId;
  const existing = await entityService.getEntityById(entityId, actorUserId);
  const reference = { resourceType: 'entity' as const, resourceId: entityId };
  const lockingEnabled = await runtimeConfigPort.isCapabilityEnabled('locking');
  let acquiredForDeletion = false;
  try {
    // Do not create a lock as a side effect for an actor who cannot delete.
    await accessControlPort.assertCanDeleteEntity(actorUserId, existing.id);
    if (lockingEnabled) {
      const lock = await lockService.isLocked(reference);
      if (!lock.locked) {
        await lockService.lock(reference, actorUserId, identity.sessionId, undefined, { scopeNodeId: existing.parentNodeId });
        acquiredForDeletion = true;
      }
    }
    const cmd = {
      actorUserId,
      actorSessionId: identity.sessionId,
      entityId,
      expectedRowVersion: input.expectedRowVersion ?? existing.rowVersion,
    };
    await runWithRealtimeOutbox(
      () => entityService.deleteEntity(cmd),
      () => ({ resourceType: 'entity', resourceId: existing.id, changeType: 'deleted', actorUserId, parentNodeId: existing.parentNodeId, entityTypeId: existing.entityTypeId })
    );
    await publishAuditRealtimeChange({ resourceType: 'entity', resourceId: existing.id, changeType: 'deleted', actorUserId });

    if (lockingEnabled) {
      try {
        await lockService.unlock(reference, actorUserId, identity.sessionId, { scopeNodeId: existing.parentNodeId });
      } catch (error) {
        // La cancellazione è già stata completata; il TTL del lock resta il
        // fallback se il rilascio esplicito non riesce.
        console.error('[EntityActions] Failed to release deleted entity lock:', error);
      }
    }
    return { deleted: true, parentNodeId: existing.parentNodeId, entityTypeId: existing.entityTypeId };
  } catch (error) {
    if (acquiredForDeletion) {
      try {
        await lockService.unlock(reference, actorUserId, identity.sessionId, { scopeNodeId: existing.parentNodeId });
      } catch (unlockError) {
        console.error('[EntityActions] Failed to release entity lock after unsuccessful deletion:', unlockError);
      }
    }
    throw error;
  }
  });
}

function toEntityDto(e: { id: string; entityTypeId: string; parentNodeId: string; name: string; description: string; rowVersion: number; createdAt: Date; updatedAt: Date; payload: Record<string, unknown> }) {
  return {
    id: e.id, entityTypeId: e.entityTypeId, parentNodeId: e.parentNodeId, name: e.name, description: e.description,
    rowVersion: e.rowVersion, createdAt: e.createdAt.toISOString(), updatedAt: e.updatedAt.toISOString(), payload: e.payload || {},
  };
}

export async function listEntitiesAction(parentNodeId: string) {
  return withSafeActionErrors(async () => {
  const { entityService } = await import('../../server/db');
  const actorUserId = await AuthResolver.resolveActorUserId();
  const entities = await entityService.listEntitiesByNode(parentNodeId, actorUserId);
  return entities.map((e) => ({
    id: e.id,
    entityTypeId: e.entityTypeId,
    parentNodeId: e.parentNodeId,
    name: e.name,
    description: e.description,
    rowVersion: e.rowVersion,
    createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : String(e.createdAt),
    updatedAt: e.updatedAt instanceof Date ? e.updatedAt.toISOString() : String(e.updatedAt),
    payload: e.payload || {},
  }));
  });
}

export async function listEntityTypesAction() {
  return withSafeActionErrors(async () => {
  await AuthResolver.resolveActorUserId();
  const { entityTypeRepository } = await import('../../server/db');
  const types = await entityTypeRepository.listAll();
  return types.filter((t) => t.isActive).map((t) => ({
    id: t.id,
    typeKey: t.typeKey,
    name: t.name,
    description: t.description,
    storageTable: t.storageTable,
    currentSchemaVersion: t.currentSchemaVersion,
    isActive: t.isActive,
  }));
  });
}

export interface ListSubtreeEntitiesParams {
  baseNodeId: string;
  limit: number;
  direction?: 'forward' | 'backward';
  cursor?: { path: string; name: string; id: string };
  search?: string;
  entityTypeId?: string;
  filters?: { name?: string; description?: string; lockState?: 'locked' | 'unlocked' };
}

function validateListSubtreeEntitiesParams(params: ListSubtreeEntitiesParams): ListSubtreeEntitiesParams {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.baseNodeId)) throw new Error('baseNodeId non valido');
  if (!Number.isInteger(params.limit) || params.limit < 1 || params.limit > 200) throw new Error('limit deve essere compreso tra 1 e 200');
  if (params.search && params.search.length > 200) throw new Error('search troppo lungo');
  if (params.filters && Object.values(params.filters).some((value) => typeof value === 'string' && value.length > 200)) throw new Error('filtro troppo lungo');
  if (params.filters?.lockState && !['locked', 'unlocked'].includes(params.filters.lockState)) throw new Error('lockState non valido');
  return params;
}

export async function listSubtreeEntitiesAction(params: ListSubtreeEntitiesParams) {
  return withSafeActionErrors(async () => {
  const { entitySubtreeQueryPort } = await import('../../server/db');
  const actorUserId = await AuthResolver.resolveActorUserId();
  const validated = validateListSubtreeEntitiesParams(params);
  const result = await entitySubtreeQueryPort.findSubtreeEntitiesPaginated({ ...validated, actorUserId });
  return {
    items: result.items.map((item) => {
      const { lockExpiresAt, ...itemWithoutLockDate } = item;
      return {
      ...itemWithoutLockDate,
      createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : String(item.createdAt),
      updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : String(item.updatedAt),
      ...(lockExpiresAt
        ? { lockExpiresAt: lockExpiresAt instanceof Date ? lockExpiresAt.toISOString() : String(lockExpiresAt) }
        : {}),
      };
    }),
    nextCursor: result.nextCursor,
    prevCursor: result.prevCursor,
    hasMore: result.hasMore,
  };
  });
}

export async function getEntityByIdAction(entityId: string) {
  return withSafeActionErrors(async () => {
  const { entityService } = await import('../../server/db');
  const actorUserId = await AuthResolver.resolveActorUserId();
  const e = await entityService.getEntityById(entityId, actorUserId);
  return {
    id: e.id,
    entityTypeId: e.entityTypeId,
    parentNodeId: e.parentNodeId,
    name: e.name,
    description: e.description,
    rowVersion: e.rowVersion,
    createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : String(e.createdAt),
    updatedAt: e.updatedAt instanceof Date ? e.updatedAt.toISOString() : String(e.updatedAt),
    payload: e.payload || {},
  };
  });
}
