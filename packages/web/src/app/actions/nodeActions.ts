'use server';

import {
  CreateNodeCommand,
  UpdateNodeCommand,
  MoveNodeCommand,
} from '@dashboard/core';

import { AuthResolver } from './auth/AuthResolver';
import { runWithRealtimeOutbox } from '../../server/realtime';
import { withSafeActionErrors } from './errorMapping';

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

export async function listNodeTypesAction() {
  return withSafeActionErrors(async () => {
  await AuthResolver.resolveActorUserId();
  const { nodeService } = await import('../../server/db');
  return await nodeService.listNodeTypes();
  });
}

export async function createNodeAction(input: Omit<CreateNodeCommand, 'actorUserId'>) {
  return withSafeActionErrors(async () => {
  const { nodeService } = await import('../../server/db');
  const cmd: CreateNodeCommand = {
    ...input,
    actorUserId: await AuthResolver.resolveActorUserId(),
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

export async function updateNodeAction(input: Omit<UpdateNodeCommand, 'actorUserId'>) {
  return withSafeActionErrors(async () => {
  const { nodeService } = await import('../../server/db');
  const cmd: UpdateNodeCommand = {
    ...input,
    actorUserId: await AuthResolver.resolveActorUserId(),
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

export async function moveNodeAction(input: Omit<MoveNodeCommand, 'actorUserId'>) {
  return withSafeActionErrors(async () => {
  const { nodeService } = await import('../../server/db');
  const cmd: MoveNodeCommand = {
    ...input,
    actorUserId: await AuthResolver.resolveActorUserId(),
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

function toNodeDto(n: { id: string; parentId: string | null; path: string; pathLabel: string; depth: number; nodeTypeId: string; name: string; description: string; rowVersion: number; payload: Record<string, unknown> }) {
  return { id: n.id, parentId: n.parentId, path: n.path, pathLabel: n.pathLabel, depth: n.depth, nodeTypeId: n.nodeTypeId, name: n.name, description: n.description, rowVersion: n.rowVersion, payload: n.payload };
}
