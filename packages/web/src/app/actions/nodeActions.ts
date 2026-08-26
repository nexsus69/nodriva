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
import { publishAuditRealtimeChange } from '../../server/adminRealtime';
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
  await publishAuditRealtimeChange({ resourceType: 'node', resourceId: node.id, changeType: 'created', actorUserId: cmd.actorUserId });
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
  await publishAuditRealtimeChange({ resourceType: 'node', resourceId: node.id, changeType: 'updated', actorUserId: cmd.actorUserId });
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
    await publishAuditRealtimeChange({ resourceType: 'node', resourceId: moved.id, changeType: 'moved', actorUserId: cmd.actorUserId });
    return toNodeDto(moved);
  }
  return moved;
  });
}

export async function deleteNodeAction(input: Omit<DeleteNodeCommand, 'actorUserId' | 'actorSessionId'>) {
  return nodeMutationResult(async () => {
    const { nodeService } = await import('../../server/db');
    const identity = await AuthResolver.resolveActorIdentity();
    const cmd: DeleteNodeCommand = { ...input, actorUserId: identity.userId, actorSessionId: identity.sessionId };
    await runWithRealtimeOutbox(
      () => nodeService.deleteNode(cmd),
      () => ({ resourceType: 'node', resourceId: input.nodeId, changeType: 'deleted', actorUserId: identity.userId }),
    );
    await publishAuditRealtimeChange({ resourceType: 'node', resourceId: input.nodeId, changeType: 'deleted', actorUserId: identity.userId });
    return { deleted: true };
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
    await publishAuditRealtimeChange({ resourceType: 'node', resourceId: input.nodeId, changeType: 'restored', actorUserId: identity.userId });
    return { restored: true };
  });
}

function toNodeDto(n: { id: string; parentId: string | null; path: string; pathLabel: string; depth: number; nodeTypeId: string; name: string; description: string; rowVersion: number; payload: Record<string, unknown> }) {
  return { id: n.id, parentId: n.parentId, path: n.path, pathLabel: n.pathLabel, depth: n.depth, nodeTypeId: n.nodeTypeId, name: n.name, description: n.description, rowVersion: n.rowVersion, payload: n.payload };
}
