'use server';

import { AuthResolver } from './auth/AuthResolver';
import { publishRealtimeChange } from '../../server/realtime';
interface CreateEntityActionInput {
  parentNodeId: string;
  entityTypeKey?: string;
  entityTypeId?: string;
  name: string;
  description?: string;
  payload?: Record<string, unknown>;
  payloadDelta?: Record<string, unknown>;
  expectedParentRowVersion?: number;
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

export async function createEntityAction(input: CreateEntityActionInput) {
  const { entityService } = await import('../../server/db');
  const entityTypeKey = input.entityTypeKey || input.entityTypeId;
  if (!entityTypeKey) {
    throw new Error('entityTypeKey is required');
  }
  const cmd = {
    actorUserId: await AuthResolver.resolveActorUserId(),
    parentNodeId: input.parentNodeId,
    entityTypeKey,
    name: input.name,
    description: input.description,
    payload: input.payload || input.payloadDelta || {},
    expectedParentRowVersion: input.expectedParentRowVersion,
  };
  const e = await entityService.createEntity(cmd);
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
  await publishRealtimeChange({
    resourceType: 'entity',
    resourceId: result.id,
    changeType: 'created',
    actorUserId: cmd.actorUserId,
    parentNodeId: result.parentNodeId,
    entityTypeId: result.entityTypeId,
    data: result,
  });
  return result;
}

export async function updateEntityAction(input: UpdateEntityActionInput) {
  const { entityService } = await import('../../server/db');
  const entityId = input.entityId || input.id;
  if (!entityId) {
    throw new Error('entityId is required');
  }
  const cmd = {
    actorUserId: await AuthResolver.resolveActorUserId(),
    entityId,
    name: input.name,
    description: input.description,
    expectedRowVersion: input.expectedRowVersion || input.rowVersion,
    payloadDelta: input.payloadDelta || input.payload,
  };
  const e = await entityService.updateEntity(cmd);
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
  await publishRealtimeChange({
    resourceType: 'entity',
    resourceId: result.id,
    changeType: 'updated',
    actorUserId: cmd.actorUserId,
    parentNodeId: result.parentNodeId,
    entityTypeId: result.entityTypeId,
    data: result,
  });
  return result;
}

export async function deleteEntityAction(input: string | { entityId?: string; id?: string }) {
  const { entityService, lockService, runtimeConfigPort } = await import('../../server/db');
  const entityId = typeof input === 'string' ? input : input.entityId || input.id;
  if (!entityId) {
    throw new Error('entityId is required');
  }
  const actorUserId = await AuthResolver.resolveActorUserId();
  const existing = await entityService.getEntityById(entityId, actorUserId);
  const cmd = {
    actorUserId,
    entityId,
  };
  await entityService.deleteEntity(cmd);
  await publishRealtimeChange({
    resourceType: 'entity',
    resourceId: existing.id,
    changeType: 'deleted',
    actorUserId,
    parentNodeId: existing.parentNodeId,
    entityTypeId: existing.entityTypeId,
  });

  if (await runtimeConfigPort.isCapabilityEnabled('locking')) {
    try {
      await lockService.unlock('entity', entityId, actorUserId);
    } catch (error) {
      // La cancellazione è già stata completata; il TTL del lock resta il
      // fallback se il rilascio esplicito non riesce.
      console.error('[EntityActions] Failed to release deleted entity lock:', error);
    }
  }
}

export async function listEntitiesAction(parentNodeId: string) {
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
}

export async function listEntityTypesAction() {
  await AuthResolver.resolveActorUserId();
  const { entityTypeRepository } = await import('../../server/db');
  const types = await entityTypeRepository.listAll();
  return types.map((t) => ({
    id: t.id,
    typeKey: t.typeKey,
    name: t.name,
    description: t.description,
    storageTable: t.storageTable,
    currentSchemaVersion: t.currentSchemaVersion,
    isActive: t.isActive,
  }));
}

export interface ListSubtreeEntitiesParams {
  baseNodeId: string;
  limit: number;
  direction?: 'forward' | 'backward';
  cursor?: { path: string; name: string; id: string };
  search?: string;
  entityTypeId?: string;
}

export async function listSubtreeEntitiesAction(params: ListSubtreeEntitiesParams) {
  const { entitySubtreeQueryPort } = await import('../../server/db');
  const actorUserId = await AuthResolver.resolveActorUserId();
  const result = await entitySubtreeQueryPort.findSubtreeEntitiesPaginated({ ...params, actorUserId });
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
}

export async function getEntityByIdAction(entityId: string) {
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
}
