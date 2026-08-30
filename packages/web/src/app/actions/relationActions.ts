'use server';

/** Provides authenticated server boundaries for relationship reads, previews and commits. */

import { AuthResolver } from './auth/AuthResolver';
import { mapAppErrorToApiErrorResponse, withSafeActionErrors } from './errorMapping';
import { ValidationError, type ApiErrorResponse, type NodeRepository, type TypeDomain } from '@dashboard/core';
import { runWithRealtimeOutbox } from '../../server/realtime';

export interface RelationCandidate {
  id: string;
  name: string;
  resourceType: 'node' | 'entity';
  parentNodeId: string | null;
  pathLabel: string | null;
  rowVersion: number;
}

const MAX_CANDIDATES = 50;

type RelationActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: ApiErrorResponse };

/** Returns expected relationship failures as serializable action data. */
async function runRelationAction<T>(operation: () => Promise<T>): Promise<RelationActionResult<T>> {
  try {
    return { success: true, data: await operation() };
  } catch (error) {
    return { success: false, error: mapAppErrorToApiErrorResponse(error) };
  }
}

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

    const readableNodes: Array<{ id: string; pathLabel: string; nodeTypeId: string; rowVersion: number }> = [];
    const roots = readableNodeRepository.listReadableVirtualRoots
      ? await readableNodeRepository.listReadableVirtualRoots(actorUserId)
      : await (await import('../../server/db')).securityRepository.listRealtimeVirtualRootNodeIds(actorUserId)
        .then(async (ids) => (await Promise.all(ids.map((id) => nodeService.getNodeById(id, actorUserId)))).filter((node): node is NonNullable<typeof node> => Boolean(node)));
    const visit = async (node: { id: string; pathLabel: string; nodeTypeId: string; rowVersion: number }): Promise<void> => {
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
        candidates.push({ id: node.id, name: node.pathLabel, resourceType: 'node', parentNodeId: null, pathLabel: node.pathLabel, rowVersion: node.rowVersion });
        if (candidates.length >= limit) break;
      }
    } else {
      for (const node of readableNodes) {
        const entities = await entityRepository.listByNode(node.id, 200, 0);
        for (const entity of entities) {
          if (entity.entityTypeId !== targetType.id) continue;
          if (search && !`${entity.name} ${entity.description} ${node.pathLabel}`.toLocaleLowerCase().includes(search)) continue;
          candidates.push({ id: entity.id, name: entity.name, resourceType: 'entity', parentNodeId: entity.parentNodeId, pathLabel: node.pathLabel, rowVersion: entity.rowVersion });
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
    return resolveRelationCandidate(input, actorUserId);
  });
}

/** Resolves one candidate after the caller has already established an actor identity. */
async function resolveRelationCandidate(
  input: { resourceType: 'node' | 'entity'; typeKey: string; resourceId: string },
  actorUserId: string,
): Promise<RelationCandidate | null> {
    const { entityRepository, nodeRepository, entityTypeRepository, nodeTypeRepository, accessControlPort, nodeService } = await import('../../server/db');
    if (input.resourceType === 'entity') {
      const targetType = await entityTypeRepository.findByKey(input.typeKey);
      const entity = await entityRepository.findById(input.resourceId);
      if (!targetType || !targetType.isActive || !entity || entity.entityTypeId !== targetType.id) return null;
      await accessControlPort.assertHasPermission(actorUserId, 'entity.read', entity.parentNodeId);
      const node = await nodeService.getNodeById(entity.parentNodeId, actorUserId);
      return node ? { id: entity.id, name: entity.name, resourceType: 'entity', parentNodeId: entity.parentNodeId, pathLabel: node.pathLabel, rowVersion: entity.rowVersion } : null;
    }
    const targetType = await nodeTypeRepository.findByKey(input.typeKey);
    const node = await nodeRepository.findById(input.resourceId);
    if (!targetType || !targetType.isActive || !node || node.nodeTypeId !== targetType.id) return null;
    await accessControlPort.assertCanReadNode(actorUserId, node.id);
    return { id: node.id, name: node.pathLabel, resourceType: 'node', parentNodeId: node.parentId, pathLabel: node.pathLabel, rowVersion: node.rowVersion };
}

export interface IncomingRelationshipGroup {
  definition: {
    sourceDomain: TypeDomain;
    sourceTypeKey: string;
    sourceTypeName: string;
    sourceFieldId: string;
    sourceFieldKey: string;
    sourceFieldLabel: string;
    sourceCardinality: 'one' | 'many';
    targetIsUnique: boolean;
    inverseLabel: string | null;
  };
  linkedSources: RelationCandidate[];
}

/** Serializable preview returned before an inverse relationship batch is committed. */
export interface IncomingRelationshipMutationPreview {
  items: Array<{
    resourceId: string;
    kind: 'add' | 'append' | 'replace' | 'remove' | 'no_change';
    previousTargetIds: string[];
    nextTargetIds: string[];
    requiresConfirmation: boolean;
  }>;
  replacementSourceIds: string[];
  unavailableSourceIds: string[];
}

/** Lists ACL-filtered inverse relations for one readable resource instance. */
export async function listIncomingRelationshipsAction(input: {
  targetDomain: TypeDomain;
  targetTypeKey: string;
  targetResourceId: string;
}): Promise<RelationActionResult<IncomingRelationshipGroup[]>> {
  return runRelationAction(async () => {
    const actorUserId = await AuthResolver.resolveActorUserId();
    const {
      entityService,
      nodeService,
      entityTypeRepository,
      nodeTypeRepository,
      resourceRelationshipDefinitionReader,
      resourceRelationshipRepository,
    } = await import('../../server/db');

    if (input.targetDomain === 'node') {
      const [expectedType, target] = await Promise.all([
        nodeTypeRepository.findByKey(input.targetTypeKey),
        nodeService.getNodeById(input.targetResourceId, actorUserId),
      ]);
      if (!expectedType || !expectedType.isActive || !target || target.nodeTypeId !== expectedType.id) {
        throw new ValidationError('The requested target resource is unavailable.', {
          targetResourceId: ['The resource does not match the requested type.'],
        });
      }
    } else {
      const [expectedType, target] = await Promise.all([
        entityTypeRepository.findByKey(input.targetTypeKey),
        entityService.getEntityById(input.targetResourceId, actorUserId),
      ]);
      if (!expectedType || !expectedType.isActive || !target || target.entityTypeId !== expectedType.id) {
        throw new ValidationError('The requested target resource is unavailable.', {
          targetResourceId: ['The resource does not match the requested type.'],
        });
      }
    }

    const definitions = await resourceRelationshipDefinitionReader.listIncomingDefinitions(
      input.targetDomain,
      input.targetTypeKey,
    );
    const incoming = await resourceRelationshipRepository.listIncoming(
      input.targetDomain,
      input.targetResourceId,
    );
    return Promise.all(definitions.map(async (definition) => {
      const edges = incoming.filter((edge) => edge.sourceFieldId === definition.sourceFieldId);
      const candidates = await Promise.all(edges.map((edge) => resolveRelationCandidate({
        resourceType: definition.sourceDomain,
        typeKey: definition.sourceTypeKey,
        resourceId: edge.sourceResourceId,
      }, actorUserId)));
      return {
        definition,
        linkedSources: candidates.filter((candidate): candidate is RelationCandidate => candidate !== null),
      };
    }));
  });
}

/** Prepares an ACL-checked relationship preview without writing or reserving resources. */
export async function prepareIncomingRelationshipAction(input: {
  sourceDomain: TypeDomain;
  sourceTypeKey: string;
  sourceFieldKey: string;
  targetDomain: TypeDomain;
  targetResourceId: string;
  operation: 'link' | 'unlink';
  sources: Array<{ resourceId: string; expectedRowVersion: number }>;
}): Promise<RelationActionResult<IncomingRelationshipMutationPreview>> {
  return runRelationAction(async () => {
    const identity = await AuthResolver.resolveActorIdentity();
    const { resourceRelationshipMutationService } = await import('../../server/db');
    const plan = await resourceRelationshipMutationService.prepare({
      ...input,
      actorUserId: identity.userId,
      actorSessionId: identity.sessionId,
    });
    return {
      items: plan.items.map((item) => ({
        resourceId: item.resourceId,
        kind: item.impact.kind,
        previousTargetIds: [...item.impact.beforeTargetIds],
        nextTargetIds: [...item.impact.afterTargetIds],
        requiresConfirmation: item.impact.requiresConfirmation,
      })),
      replacementSourceIds: [...plan.replacementSourceIds],
      unavailableSourceIds: [...(plan.unavailableSourceIds ?? [])],
    };
  });
}

/** Mutates one inverse relationship group atomically and emits one event per changed source. */
export async function mutateIncomingRelationshipAction(input: {
  sourceDomain: TypeDomain;
  sourceTypeKey: string;
  sourceFieldKey: string;
  targetDomain: TypeDomain;
  targetResourceId: string;
  operation: 'link' | 'unlink';
  sources: Array<{ resourceId: string; expectedRowVersion: number }>;
  acceptedReplacementSourceIds?: string[];
}): Promise<RelationActionResult<Array<ReturnType<typeof toNodeRelationDto> | ReturnType<typeof toEntityRelationDto>>>> {
  return runRelationAction(async () => {
    const identity = await AuthResolver.resolveActorIdentity();
    const { resourceRelationshipMutationService } = await import('../../server/db');
    const result = await runWithRealtimeOutbox(
      () => resourceRelationshipMutationService.mutate({
        ...input,
        actorUserId: identity.userId,
        actorSessionId: identity.sessionId,
      }),
      ({ changedResources }) => changedResources.map(({ domain, resource }) => domain === 'node'
        ? {
            resourceType: 'node' as const,
            resourceId: resource.id,
            changeType: 'updated' as const,
            actorUserId: identity.userId,
            parentNodeId: resource.parentId,
            data: toNodeRelationDto(resource),
          }
        : {
            resourceType: 'entity' as const,
            resourceId: resource.id,
            changeType: 'updated' as const,
            actorUserId: identity.userId,
            parentNodeId: resource.parentNodeId,
            entityTypeId: resource.entityTypeId,
            data: toEntityRelationDto(resource),
          }),
    );
    return result.changedResources.map(({ domain, resource }) => domain === 'node'
      ? toNodeRelationDto(resource)
      : toEntityRelationDto(resource));
  });
}

function toNodeRelationDto(node: {
  id: string;
  parentId: string | null;
  nodeTypeId: string;
  name: string;
  description: string;
  rowVersion: number;
  payload: Record<string, unknown>;
}) {
  return {
    resourceType: 'node' as const,
    id: node.id,
    parentId: node.parentId,
    nodeTypeId: node.nodeTypeId,
    name: node.name,
    description: node.description,
    rowVersion: node.rowVersion,
    payload: node.payload,
  };
}

function toEntityRelationDto(entity: {
  id: string;
  parentNodeId: string;
  entityTypeId: string;
  name: string;
  description: string;
  rowVersion: number;
  payload: Record<string, unknown>;
}) {
  return {
    resourceType: 'entity' as const,
    id: entity.id,
    parentNodeId: entity.parentNodeId,
    entityTypeId: entity.entityTypeId,
    name: entity.name,
    description: entity.description,
    rowVersion: entity.rowVersion,
    payload: entity.payload,
  };
}
