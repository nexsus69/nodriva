'use server';

import {
  CreateNodeCommand,
  UpdateNodeCommand,
  MoveNodeCommand,
} from '@dashboard/core';

import { AuthResolver } from './auth/AuthResolver';

export async function listChildrenAction(parentId: string | null) {
  const { nodeService } = await import('../../server/db');
  const actorUserId = await AuthResolver.resolveActorUserId();
  const nodes = await nodeService.listChildren(parentId, actorUserId);
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
  }));
}

export async function getNodeByIdAction(id: string) {
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
  };
}

export async function listNodeTypesAction() {
  await AuthResolver.resolveActorUserId();
  const { nodeService } = await import('../../server/db');
  return await nodeService.listNodeTypes();
}

export async function createNodeAction(input: Omit<CreateNodeCommand, 'actorUserId'>) {
  const { nodeService } = await import('../../server/db');
  const cmd: CreateNodeCommand = {
    ...input,
    actorUserId: await AuthResolver.resolveActorUserId(),
  };
  const node = await nodeService.createNode(cmd);
  return {
    id: node.id,
    parentId: node.parentId,
    path: node.path,
    pathLabel: node.pathLabel,
    depth: node.depth,
    nodeTypeId: node.nodeTypeId,
    name: node.name,
    description: node.description,
    rowVersion: node.rowVersion,
  };
}

export async function updateNodeAction(input: Omit<UpdateNodeCommand, 'actorUserId'>) {
  const { nodeService } = await import('../../server/db');
  const cmd: UpdateNodeCommand = {
    ...input,
    actorUserId: await AuthResolver.resolveActorUserId(),
  };
  const node = await nodeService.updateNode(cmd);
  return {
    id: node.id,
    parentId: node.parentId,
    path: node.path,
    pathLabel: node.pathLabel,
    depth: node.depth,
    nodeTypeId: node.nodeTypeId,
    name: node.name,
    description: node.description,
    rowVersion: node.rowVersion,
  };
}

export async function moveNodeAction(input: Omit<MoveNodeCommand, 'actorUserId'>) {
  const { nodeService } = await import('../../server/db');
  const cmd: MoveNodeCommand = {
    ...input,
    actorUserId: await AuthResolver.resolveActorUserId(),
  };
  await nodeService.moveNode(cmd);
  return await getNodeByIdAction(input.nodeId);
}
