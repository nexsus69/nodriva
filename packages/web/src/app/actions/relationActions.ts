'use server';

import { AuthResolver } from './auth/AuthResolver';
import { withSafeActionErrors } from './errorMapping';
import { ValidationError } from '@dashboard/core';
import type { NodeRepository } from '@dashboard/core';

export interface RelationCandidate {
  id: string;
  name: string;
  resourceType: 'node' | 'entity';
  parentNodeId: string | null;
  pathLabel: string | null;
}

export async function validateRelationPayload(actorUserId: string, entityTypeKey: string, payload: Record<string, unknown>): Promise<void> {
  const { typeReader, accessControlPort, entityRepository, nodeRepository, entityTypeRepository, nodeTypeRepository } = await import('../../server/db');
  const definition = await typeReader.readDefinition('entity', entityTypeKey);
  if (!definition) return;
  for (const field of definition.fields) {
    if (field.dataType !== 'relation') continue;
    const value = payload[field.fieldKey];
    if (value === null || value === undefined || value === '') continue;
    if (typeof value !== 'string') throw new ValidationError(`Relation field '${field.fieldKey}' must contain a resource identifier.`, { [field.fieldKey]: ['Invalid resource identifier.'] });
    const targetTypeKey = field.relationTargetTypeKey;
    const targetDomain = field.relationTargetDomain;
    if (!targetTypeKey || !targetDomain) throw new ValidationError(`Relation field '${field.fieldKey}' has no target definition.`, { [field.fieldKey]: ['Missing target definition.'] });
    if (targetDomain === 'entity') {
      const targetType = await entityTypeRepository.findByKey(targetTypeKey);
      const target = await entityRepository.findById(value);
      if (!targetType || !target || target.entityTypeId !== targetType.id) throw new ValidationError(`The relation target for '${field.fieldKey}' is invalid or unavailable.`, { [field.fieldKey]: ['Target is invalid or unavailable.'] });
      await accessControlPort.assertHasPermission(actorUserId, 'entity.read', target.parentNodeId);
    } else {
      const targetType = await nodeTypeRepository.findByKey(targetTypeKey);
      const target = await nodeRepository.findById(value);
      if (!targetType || !target || target.nodeTypeId !== targetType.id) throw new ValidationError(`The relation target for '${field.fieldKey}' is invalid or unavailable.`, { [field.fieldKey]: ['Target is invalid or unavailable.'] });
      await accessControlPort.assertCanReadNode(actorUserId, target.id);
    }
  }
}

const MAX_CANDIDATES = 50;

export async function searchRelationCandidatesAction(input: {
  resourceType: 'node' | 'entity';
  typeKey: string;
  search?: string;
  limit?: number;
}) {
  return withSafeActionErrors(async () => {
    const search = (input.search ?? '').trim().slice(0, 100).toLocaleLowerCase();
    const limit = Math.min(Math.max(input.limit ?? 20, 1), MAX_CANDIDATES);
    const actorUserId = await AuthResolver.resolveActorUserId();
    const { nodeRepository, nodeService, entityRepository, nodeTypeRepository, entityTypeRepository } = await import('../../server/db');
    const readableNodeRepository = nodeRepository as NodeRepository;
    const targetType = input.resourceType === 'node'
      ? await nodeTypeRepository.findByKey(input.typeKey)
      : await entityTypeRepository.findByKey(input.typeKey);
    if (!targetType || !targetType.isActive) return [];

    const readableNodes: Array<{ id: string; pathLabel: string; nodeTypeId: string }> = [];
    const roots = readableNodeRepository.listReadableVirtualRoots
      ? await readableNodeRepository.listReadableVirtualRoots(actorUserId)
      : await (await import('../../server/db')).securityRepository.listRealtimeVirtualRootNodeIds(actorUserId)
        .then(async (ids) => (await Promise.all(ids.map((id) => nodeService.getNodeById(id, actorUserId)))).filter((node): node is NonNullable<typeof node> => Boolean(node)));
    const visit = async (node: { id: string; pathLabel: string; nodeTypeId: string }): Promise<void> => {
      readableNodes.push(node);
      if (readableNodes.length >= 500) return;
      const children = readableNodeRepository.listReadableChildren
        ? await readableNodeRepository.listReadableChildren(node.id, actorUserId)
        : await nodeService.listChildren(node.id, actorUserId);
      for (const child of children) {
        if (readableNodes.length >= 500) break;
        await visit(child);
      }
    };
    for (const root of roots) {
      if (readableNodes.length >= 500) break;
      await visit(root);
    }

    const candidates: RelationCandidate[] = [];
    if (input.resourceType === 'node') {
      for (const node of readableNodes) {
        if (node.nodeTypeId !== targetType.id) continue;
        if (search && !`${node.pathLabel} ${node.id}`.toLocaleLowerCase().includes(search)) continue;
        candidates.push({ id: node.id, name: node.pathLabel, resourceType: 'node', parentNodeId: null, pathLabel: node.pathLabel });
        if (candidates.length >= limit) break;
      }
    } else {
      for (const node of readableNodes) {
        const entities = await entityRepository.listByNode(node.id, 200, 0);
        for (const entity of entities) {
          if (entity.entityTypeId !== targetType.id) continue;
          if (search && !`${entity.name} ${entity.description} ${node.pathLabel}`.toLocaleLowerCase().includes(search)) continue;
          candidates.push({ id: entity.id, name: entity.name, resourceType: 'entity', parentNodeId: entity.parentNodeId, pathLabel: node.pathLabel });
          if (candidates.length >= limit) return candidates;
        }
      }
    }
    return candidates;
  });
}

export async function resolveRelationCandidateAction(input: {
  resourceType: 'node' | 'entity';
  typeKey: string;
  resourceId: string;
}): Promise<RelationCandidate | null> {
  return withSafeActionErrors(async () => {
    const actorUserId = await AuthResolver.resolveActorUserId();
    const { entityRepository, nodeRepository, entityTypeRepository, nodeTypeRepository, accessControlPort, nodeService } = await import('../../server/db');
    if (input.resourceType === 'entity') {
      const targetType = await entityTypeRepository.findByKey(input.typeKey);
      const entity = await entityRepository.findById(input.resourceId);
      if (!targetType || !targetType.isActive || !entity || entity.entityTypeId !== targetType.id) return null;
      await accessControlPort.assertHasPermission(actorUserId, 'entity.read', entity.parentNodeId);
      const node = await nodeService.getNodeById(entity.parentNodeId, actorUserId);
      return node ? { id: entity.id, name: entity.name, resourceType: 'entity', parentNodeId: entity.parentNodeId, pathLabel: node.pathLabel } : null;
    }
    const targetType = await nodeTypeRepository.findByKey(input.typeKey);
    const node = await nodeRepository.findById(input.resourceId);
    if (!targetType || !targetType.isActive || !node || node.nodeTypeId !== targetType.id) return null;
    await accessControlPort.assertCanReadNode(actorUserId, node.id);
    return { id: node.id, name: node.pathLabel, resourceType: 'node', parentNodeId: node.parentId, pathLabel: node.pathLabel };
  });
}
