'use server';

import { AuthResolver } from './auth/AuthResolver';
import { mapAppErrorToApiErrorResponse } from './errorMapping';
import type { ApiErrorResponse } from '@dashboard/core';

type RecycleActionResult<T> = { success: true; data: T } | { success: false; error: ApiErrorResponse };
import { runWithRealtimeOutbox } from '../../server/realtime';
import { publishAuditRealtimeChange } from '../../server/adminRealtime';

export interface DeletedEntityListItem {
  id: string;
  entityTypeId: string;
  entityTypeName: string;
  entityTypeActive: boolean;
  parentNodeId: string;
  parentNodeName: string;
  name: string;
  description: string;
  rowVersion: number;
  deletedAt: string;
  updatedBy: string | null;
}

export interface DeletedNodeListItem {
  id: string;
  nodeTypeId: string;
  nodeTypeName: string;
  parentId: string | null;
  parentName: string | null;
  name: string;
  path: string;
  rowVersion: number;
  deletedAt: string;
  deletionBatchId: string | null;
}

export async function listDeletedNodesAction(input?: { limit?: number; offset?: number }): Promise<RecycleActionResult<DeletedNodeListItem[]>> {
  try {
    const { nodeService } = await import('../../server/db');
    const actorUserId = await AuthResolver.resolveActorUserId();
    const rows = await nodeService.listDeletedNodes(actorUserId, Math.min(Math.max(input?.limit ?? 100, 1), 200), Math.max(input?.offset ?? 0, 0));
    return { success: true, data: rows.map((row) => ({ ...row, deletedAt: new Date(row.deletedAt).toISOString() })) };
  } catch (error) {
    return { success: false, error: mapAppErrorToApiErrorResponse(error) };
  }
}

export async function restoreDeletedNodeAction(input: { nodeId: string; expectedRowVersion: number }) {
  try {
    const { nodeService } = await import('../../server/db');
    const identity = await AuthResolver.resolveActorIdentity();
    await runWithRealtimeOutbox(
      () => nodeService.restoreNode({ actorUserId: identity.userId, actorSessionId: identity.sessionId, nodeId: input.nodeId, expectedRowVersion: input.expectedRowVersion }),
      () => ({ resourceType: 'node', resourceId: input.nodeId, changeType: 'restored', actorUserId: identity.userId }),
    );
    await publishAuditRealtimeChange({ resourceType: 'node', resourceId: input.nodeId, changeType: 'restored', actorUserId: identity.userId });
    return { success: true, data: { restored: true } } as const;
  } catch (error) {
    return { success: false, error: mapAppErrorToApiErrorResponse(error) } as const;
  }
}

export async function purgeDeletedNodeAction(input: { nodeId: string; confirmation: string }) {
  try {
    if (input.confirmation !== 'ELIMINA DEFINITIVAMENTE') return { success: false, error: { code: 'VALIDATION_ERROR', message: 'Conferma non valida.' } } as const;
    const { deletedResourcePurgeService } = await import('../../server/db');
    const actorUserId = await AuthResolver.resolveActorUserId();
    await deletedResourcePurgeService.purgeNodeSubtree(actorUserId, input.nodeId);
    return { success: true, data: { purged: true } } as const;
  } catch (error) {
    return { success: false, error: mapAppErrorToApiErrorResponse(error) } as const;
  }
}

export async function purgeDeletedEntityAction(input: { entityId: string; confirmation: string }) {
  try {
    if (input.confirmation !== 'ELIMINA DEFINITIVAMENTE') return { success: false, error: { code: 'VALIDATION_ERROR', message: 'Conferma non valida.' } } as const;
    const { deletedResourcePurgeService } = await import('../../server/db');
    const actorUserId = await AuthResolver.resolveActorUserId();
    await deletedResourcePurgeService.purgeEntity(actorUserId, input.entityId);
    return { success: true, data: { purged: true } } as const;
  } catch (error) {
    return { success: false, error: mapAppErrorToApiErrorResponse(error) } as const;
  }
}

export async function listDeletedEntitiesAction(input?: { limit?: number; offset?: number }): Promise<RecycleActionResult<DeletedEntityListItem[]>> {
  try {
    const { entityService } = await import('../../server/db');
    const actorUserId = await AuthResolver.resolveActorUserId();
    const limit = Math.min(Math.max(input?.limit ?? 100, 1), 200);
    const offset = Math.max(input?.offset ?? 0, 0);
    const rows = await entityService.listDeletedEntities(actorUserId, limit, offset);
    return { success: true, data: rows.map((row) => ({ ...row, deletedAt: new Date(row.deletedAt).toISOString() })) };
  } catch (error) {
    return { success: false, error: mapAppErrorToApiErrorResponse(error) };
  }
}

export async function restoreDeletedEntityAction(input: { entityId: string; expectedRowVersion: number }): Promise<RecycleActionResult<{ restored: boolean }>> {
  try {
    const { entityService } = await import('../../server/db');
    const identity = await AuthResolver.resolveActorIdentity();
    const existing = await entityService.getDeletedEntityById(input.entityId, identity.userId);
    await runWithRealtimeOutbox(
      () => entityService.restoreEntity({ actorUserId: identity.userId, actorSessionId: identity.sessionId, entityId: input.entityId, expectedRowVersion: input.expectedRowVersion }),
      () => existing ? {
        resourceType: 'entity',
        resourceId: input.entityId,
        changeType: 'restored',
        actorUserId: identity.userId,
        parentNodeId: existing.parentNodeId,
        entityTypeId: existing.entityTypeId,
      } : null,
    );
    if (existing) await publishAuditRealtimeChange({ resourceType: 'entity', resourceId: input.entityId, changeType: 'restored', actorUserId: identity.userId });
    return { success: true, data: { restored: true } };
  } catch (error) {
    return { success: false, error: mapAppErrorToApiErrorResponse(error) };
  }
}
