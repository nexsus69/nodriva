import { ResourceDeleteRestrictedError } from '../../domain/errors/ResourceRelationshipErrors.js';
import type { TypeDomain } from '../dto/TypeFieldDefinition.js';
import type { ResourceRelationshipRepository, ResourceRelationshipResource } from '../ports/ResourceRelationshipRepository.js';
import type { NodeRepository } from '../ports/NodeRepository.js';
import type { EntityRepository } from '../ports/EntityRepository.js';
import type { AccessControlPort } from '../ports/AccessControlPort.js';

export type DeletionResource = ResourceRelationshipResource;

/** Applies restrict and reversible outbound-edge suspension inside a caller transaction. */
export class ResourceDeletionPolicyService {
  constructor(
    private readonly relationships: ResourceRelationshipRepository,
    private readonly nodeRepository: NodeRepository,
    private readonly entityRepository: EntityRepository,
    private readonly accessControlPort: AccessControlPort,
  ) {}

  async resourcesForSubtree(nodeId: string): Promise<DeletionResource[]> {
    const nodes = await this.nodeRepository.listSubtree(nodeId);
    const nodeIds = nodes.map((node) => node.id);
    const entityIds = await this.entityRepository.listActiveIdsByNodeIds(nodeIds);
    return [...nodeIds.map((resourceId) => resource('node', resourceId)), ...entityIds.map((resourceId) => resource('entity', resourceId))];
  }

  async resourcesForDeletedBatch(deletionBatchId: string, nodeIds: readonly string[]): Promise<DeletionResource[]> {
    const entityIds = await this.entityRepository.listDeletedIdsByBatch(deletionBatchId);
    return [...nodeIds.map((resourceId) => resource('node', resourceId)), ...entityIds.map((resourceId) => resource('entity', resourceId))];
  }

  async assertRestrictAndSuspend(actorUserId: string, resources: readonly DeletionResource[], deletionBatchId: string): Promise<void> {
    const unique = uniqueResources(resources);
    await this.relationships.lockActiveTargets(unique);
    const deleting = new Set(unique.map(key));
    const incoming = await this.relationships.listActiveIncomingForTargets(unique);
    const external = incoming.filter((edge) => !deleting.has(key({ domain: edge.sourceDomain, resourceId: edge.sourceResourceId })));
    if (external.length > 0) {
      const target = unique[0]!;
      const nodeIds = external.filter((edge) => edge.sourceDomain === 'node').map((edge) => edge.sourceResourceId);
      const entityIds = external.filter((edge) => edge.sourceDomain === 'entity').map((edge) => edge.sourceResourceId);
      const resolver = this.accessControlPort.listReadableResourceIds;
      const [visibleNodes, visibleEntities] = resolver ? await Promise.all([
        resolver.call(this.accessControlPort, actorUserId, 'node', nodeIds), resolver.call(this.accessControlPort, actorUserId, 'entity', entityIds),
      ]) : [[], []];
      const [nodeLabels, entityLabels] = await Promise.all([
        this.nodeRepository.listActiveReferenceLabels?.(visibleNodes) ?? [], this.entityRepository.listActiveReferenceLabels?.(visibleEntities) ?? [],
      ]);
      throw new ResourceDeleteRestrictedError(target.domain, target.resourceId, external.length, [
        ...nodeLabels.map((value) => ({ domain: 'node' as const, ...value })),
        ...entityLabels.map((value) => ({ domain: 'entity' as const, ...value })),
      ]);
    }
    await this.relationships.suspendActiveOutgoingForSources(unique, deletionBatchId);
  }

  async restoreOutgoing(resources: readonly DeletionResource[], deletionBatchId: string): Promise<void> {
    await this.relationships.restoreSuspendedOutgoingForSources(uniqueResources(resources), deletionBatchId);
  }
}

export function resource(domain: TypeDomain, resourceId: string): DeletionResource { return { domain, resourceId }; }
function key(value: DeletionResource): string { return `${value.domain}:${value.resourceId}`; }
function uniqueResources(resources: readonly DeletionResource[]): DeletionResource[] {
  return [...new Map(resources.map((value) => [key(value), value])).values()];
}
