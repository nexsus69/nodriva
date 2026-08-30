'use server';

import {
  AppError,
  CreateNodeCommand,
  UpdateNodeCommand,
  MoveNodeCommand,
  DeleteNodeCommand,
  RestoreNodeCommand,
} from '@dashboard/core';

import { AuthResolver } from './auth/AuthResolver';
import { runWithRealtimeOutbox } from '../../server/realtime';
import { mapAppErrorToApiErrorResponse, withSafeActionErrors } from './errorMapping';
import type { ApiErrorResponse } from '@dashboard/core';

type NodeMutationActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: ApiErrorResponse };

/**
 * Expected node mutation failures cross the Server Action boundary as data.
 * This lets the form keep its unsaved values while rendering a safe message.
 */
async function nodeMutationResult<T>(operation: () => Promise<T>): Promise<NodeMutationActionResult<T>> {
  try {
    return { success: true, data: await operation() };
  } catch (error) {
    return { success: false, error: mapAppErrorToApiErrorResponse(error) };
  }
}

export async function checkNodeReadAccessAction(nodeId: string): Promise<boolean> {
  try {
    const { accessControlPort } = await import('../../server/db');
    const actorUserId = await AuthResolver.resolveActorUserId();
    await accessControlPort.assertCanReadNode(actorUserId, nodeId);
    return true;
  } catch (error) {
    if (error instanceof AppError && (
      error.code === 'ACCESS_FORBIDDEN' || error.code === 'AUTH_UNAUTHORIZED'
    )) return false;
    throw error;
  }
}

export async function listChildrenAction(parentId: string | null) {
  return withSafeActionErrors(async () => {
  const { nodeService, securityRepository, nodeRepository } = await import('../../server/db');
  const actorUserId = await AuthResolver.resolveActorUserId();
  const nodes = parentId === null
    ? nodeRepository.listReadableVirtualRoots
      ? await nodeRepository.listReadableVirtualRoots(actorUserId)
      : await Promise.all(
      (await securityRepository.listRealtimeVirtualRootNodeIds(actorUserId))
        .map((nodeId) => nodeService.getNodeById(nodeId, actorUserId))
      ).then((resolved) => resolved.filter((node): node is NonNullable<typeof node> => node !== null))
    : await nodeService.listChildren(parentId, actorUserId);
  return nodes.map((n) => ({
    id: n.id,
    parentId: n.parentId,
    path: n.path,
    pathLabel: n.pathLabel,
    depth: n.depth,
    nodeTypeId: n.nodeTypeId,
    name: n.name,
    description: n.description,
    rowVersion: n.rowVersion,
    payload: n.payload,
  }));
  });
}

export async function getNodeByIdAction(id: string) {
  return withSafeActionErrors(async () => {
  const { nodeService } = await import('../../server/db');
  const actorUserId = await AuthResolver.resolveActorUserId();
  const n = await nodeService.getNodeById(id, actorUserId);
  if (!n) return null;
  return {
    id: n.id,
    parentId: n.parentId,
    path: n.path,
    pathLabel: n.pathLabel,
    depth: n.depth,
    nodeTypeId: n.nodeTypeId,
    name: n.name,
    description: n.description,
    rowVersion: n.rowVersion,
    payload: n.payload,
  };
  });
}

export async function getNodeBreadcrumbAction(nodeId: string) {
  return withSafeActionErrors(async () => {
    const { nodeService } = await import('../../server/db');
    const actorUserId = await AuthResolver.resolveActorUserId();
    return (await nodeService.listBreadcrumb(nodeId, actorUserId)).map(toNodeDto);
  });
}

export async function listNodeTypesAction() {
  return withSafeActionErrors(async () => {
  await AuthResolver.resolveActorUserId();
  const { nodeService } = await import('../../server/db');
  return await nodeService.listNodeTypes();
  });
}

export async function createNodeAction(input: Omit<CreateNodeCommand, 'actorUserId' | 'actorSessionId'>) {
  return nodeMutationResult(async () => {
  const { nodeService } = await import('../../server/db');
  const identity = await AuthResolver.resolveActorIdentity();
  const cmd: CreateNodeCommand = {
    ...input,
    actorUserId: identity.userId,
    actorSessionId: identity.sessionId,
  };
  const node = await runWithRealtimeOutbox(
    () => nodeService.createNode(cmd),
    (created) => ({ resourceType: 'node', resourceId: created.id, changeType: 'created', actorUserId: cmd.actorUserId, parentNodeId: created.parentId, data: toNodeDto(created) })
  );
  const result = {
    id: node.id,
    parentId: node.parentId,
    path: node.path,
    pathLabel: node.pathLabel,
    depth: node.depth,
    nodeTypeId: node.nodeTypeId,
    name: node.name,
    description: node.description,
    rowVersion: node.rowVersion,
    payload: node.payload,
  };
  return result;
  });
}

export async function updateNodeAction(input: Omit<UpdateNodeCommand, 'actorUserId' | 'actorSessionId'>) {
  return nodeMutationResult(async () => {
  const { nodeService } = await import('../../server/db');
  const identity = await AuthResolver.resolveActorIdentity();
  const cmd: UpdateNodeCommand = {
    ...input,
    actorUserId: identity.userId,
    actorSessionId: identity.sessionId,
  };
  const node = await runWithRealtimeOutbox(
    () => nodeService.updateNode(cmd),
    (updated) => ({ resourceType: 'node', resourceId: updated.id, changeType: 'updated', actorUserId: cmd.actorUserId, parentNodeId: updated.parentId, data: toNodeDto(updated) })
  );
  const result = {
    id: node.id,
    parentId: node.parentId,
    path: node.path,
    pathLabel: node.pathLabel,
    depth: node.depth,
    nodeTypeId: node.nodeTypeId,
    name: node.name,
    description: node.description,
    rowVersion: node.rowVersion,
    payload: node.payload,
  };
  return result;
  });
}

export async function moveNodeAction(input: Omit<MoveNodeCommand, 'actorUserId' | 'actorSessionId'>) {
  return nodeMutationResult(async () => {
  const { nodeService } = await import('../../server/db');
  const identity = await AuthResolver.resolveActorIdentity();
  const cmd: MoveNodeCommand = {
    ...input,
    actorUserId: identity.userId,
    actorSessionId: identity.sessionId,
  };
  const previous = await nodeService.getNodeById(input.nodeId, cmd.actorUserId);
  const { moved } = await runWithRealtimeOutbox(async () => {
    const affectedNodeIds = await nodeService.moveNode(cmd);
    const moved = await nodeService.getNodeById(input.nodeId, cmd.actorUserId);
    return { affectedNodeIds, moved };
  }, ({ affectedNodeIds, moved }) => moved ? ({
    resourceType: 'node', resourceId: moved.id, changeType: 'moved', actorUserId: cmd.actorUserId,
    parentNodeId: moved.parentId, previousParentNodeId: previous?.parentId,
    affectedResourceIds: affectedNodeIds, data: toNodeDto(moved),
  }) : null);
  if (moved) {
    return toNodeDto(moved);
  }
  return moved;
  });
}

type DeleteNodeActionInput = Omit<DeleteNodeCommand, 'actorUserId' | 'actorSessionId' | 'expectedRowVersion'> & {
  /** Detail forms send their observed version; resource menus resolve it server-side. */
  expectedRowVersion?: number;
};

export async function deleteNodeAction(input: DeleteNodeActionInput) {
  return nodeMutationResult(async () => {
    const { accessControlPort, nodeService, lockService, runtimeConfigPort } = await import('../../server/db');
    const identity = await AuthResolver.resolveActorIdentity();
    const existing = await nodeService.getNodeById(input.nodeId, identity.userId);
    if (!existing) throw new Error('Node not found.');

    const reference = { resourceType: 'node' as const, resourceId: input.nodeId };
    const lockingEnabled = await runtimeConfigPort.isCapabilityEnabled('locking');
    let acquiredForDeletion = false;
    try {
      // Do not create a lock as a side effect for an actor who cannot delete.
      await accessControlPort.assertHasPermission(identity.userId, 'node.delete', existing.id);
      if (lockingEnabled) {
        const lock = await lockService.isLocked(reference);
        if (!lock.locked) {
          await lockService.lock(reference, identity.userId, identity.sessionId, undefined, { scopeNodeId: existing.id });
          acquiredForDeletion = true;
        }
      }
      const cmd: DeleteNodeCommand = {
        nodeId: input.nodeId,
        expectedRowVersion: input.expectedRowVersion ?? existing.rowVersion,
        actorUserId: identity.userId,
        actorSessionId: identity.sessionId,
      };
      await runWithRealtimeOutbox(
        () => nodeService.deleteNode(cmd),
        () => ({ resourceType: 'node', resourceId: input.nodeId, changeType: 'deleted', actorUserId: identity.userId }),
      );
      if (lockingEnabled) {
        try {
          await lockService.unlock(reference, identity.userId, identity.sessionId, { scopeNodeId: existing.id });
        } catch (error) {
          // The deletion already succeeded; the lock TTL remains a safe fallback.
          console.error('[NodeActions] Failed to release deleted node lock:', error);
        }
      }
      return { deleted: true, parentNodeId: existing.parentId };
    } catch (error) {
      if (acquiredForDeletion) {
        try {
          await lockService.unlock(reference, identity.userId, identity.sessionId, { scopeNodeId: existing.id });
        } catch (unlockError) {
          console.error('[NodeActions] Failed to release node lock after unsuccessful deletion:', unlockError);
        }
      }
      throw error;
    }
  });
}

export async function restoreNodeAction(input: Omit<RestoreNodeCommand, 'actorUserId' | 'actorSessionId'>) {
  return nodeMutationResult(async () => {
    const { nodeService } = await import('../../server/db');
    const identity = await AuthResolver.resolveActorIdentity();
    const cmd: RestoreNodeCommand = { ...input, actorUserId: identity.userId, actorSessionId: identity.sessionId };
    await runWithRealtimeOutbox(
      () => nodeService.restoreNode(cmd),
      () => ({ resourceType: 'node', resourceId: input.nodeId, changeType: 'restored', actorUserId: identity.userId }),
    );
    return { restored: true };
  });
}

function toNodeDto(n: { id: string; parentId: string | null; path: string; pathLabel: string; depth: number; nodeTypeId: string; name: string; description: string; rowVersion: number; payload: Record<string, unknown> }) {
  return { id: n.id, parentId: n.parentId, path: n.path, pathLabel: n.pathLabel, depth: n.depth, nodeTypeId: n.nodeTypeId, name: n.name, description: n.description, rowVersion: n.rowVersion, payload: n.payload };
}
