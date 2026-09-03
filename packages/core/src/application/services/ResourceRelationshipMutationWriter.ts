/** Persists planned relationship values through the ordinary resource lifecycle. */

import { EntityNotFoundError } from '../../domain/errors/EntityErrors.js';
import { NodeNotFoundError, RowVersionMismatchError } from '../../domain/errors/DomainErrors.js';
import type { RelationshipMutationPlan, RelationshipMutationPlanItem } from '../dto/RelationshipMutationPlan.js';
import type { AuditPort } from '../ports/AuditPort.js';
import type { EntityRepository } from '../ports/EntityRepository.js';
import type { NodeRepository } from '../ports/NodeRepository.js';
import type { RevisionPort } from '../ports/RevisionPort.js';
import { entityAuditSnapshot, nodeAuditSnapshot } from './ResourceAuditSnapshot.js';
import type { ResourceRelationshipService } from './ResourceRelationshipService.js';
import type { Entity } from '../../domain/models/Entity.js';
import type { Node } from '../../domain/models/Node.js';

/** A resource changed by a committed relationship operation. */
export type RelationshipMutationResource =
  | { domain: 'node'; resource: Node }
  | { domain: 'entity'; resource: Entity };

/**
 * Writes one already-planned relationship value through the normal resource
 * lifecycle, including canonical edge synchronization, revisions and audit.
 *
 * The writer rechecks the submitted row version immediately before update;
 * repository updates perform the final atomic optimistic-concurrency check.
 */
export class ResourceRelationshipMutationWriter {
  constructor(
    private readonly relationshipService: ResourceRelationshipService,
    private readonly nodeRepository: NodeRepository,
    private readonly entityRepository: EntityRepository,
    private readonly auditPort: AuditPort,
    private readonly revisionPort: RevisionPort,
  ) {}

  async write(
    plan: RelationshipMutationPlan,
    item: RelationshipMutationPlanItem,
  ): Promise<RelationshipMutationResource | null> {
    if (item.impact.kind === 'no_change') return null;
    return plan.intent.sourceDomain === 'node'
      ? this.writeNode(plan, item)
      : this.writeEntity(plan, item);
  }

  private async writeNode(
    plan: RelationshipMutationPlan,
    item: RelationshipMutationPlanItem,
  ): Promise<RelationshipMutationResource> {
    const node = await this.nodeRepository.findById(item.resourceId);
    if (!node || node.deletedAt) throw new NodeNotFoundError(item.resourceId);
    if (node.rowVersion !== item.expectedRowVersion) {
      throw new RowVersionMismatchError(item.expectedRowVersion, node.rowVersion);
    }

    const currentPayload = await this.relationshipService.hydratePayloadForPersistence(
      'node', node.id, plan.intent.sourceTypeKey, node.payload,
    );
    const updated = node.update(node.name, node.description, plan.intent.actorUserId, {
      ...currentPayload,
      [plan.field.key]: relationValue(plan.field.sourceCardinality, item.impact.afterTargetIds),
    });
    await this.nodeRepository.update(updated);
    await this.relationshipService.synchronize({
      actorUserId: plan.intent.actorUserId,
      sourceDomain: 'node',
      sourceResourceId: updated.id,
      sourceTypeKey: plan.intent.sourceTypeKey,
      payload: updated.payload,
    });
    await this.revisionPort.recordNodeRevision(updated, 'updated', plan.intent.actorUserId);
    await this.auditPort.record(
      plan.intent.actorUserId,
      `relationship.${plan.intent.operation}`,
      'node',
      node.id,
      node.id,
      nodeAuditSnapshot(node),
      nodeAuditSnapshot(updated),
    );
    return { domain: 'node', resource: updated };
  }

  private async writeEntity(
    plan: RelationshipMutationPlan,
    item: RelationshipMutationPlanItem,
  ): Promise<RelationshipMutationResource> {
    const entity = await this.entityRepository.findById(item.resourceId);
    if (!entity || entity.deletedAt) throw new EntityNotFoundError(item.resourceId);
    if (entity.rowVersion !== item.expectedRowVersion) {
      throw new RowVersionMismatchError(item.expectedRowVersion, entity.rowVersion);
    }

    const currentPayload = await this.relationshipService.hydratePayloadForPersistence(
      'entity', entity.id, plan.intent.sourceTypeKey, entity.payload,
    );
    const updated = entity.update(entity.name, entity.description, {
      ...currentPayload,
      [plan.field.key]: relationValue(plan.field.sourceCardinality, item.impact.afterTargetIds),
    }, plan.intent.actorUserId);
    await this.entityRepository.update(updated);
    await this.relationshipService.synchronize({
      actorUserId: plan.intent.actorUserId,
      sourceDomain: 'entity',
      sourceResourceId: updated.id,
      sourceTypeKey: plan.intent.sourceTypeKey,
      payload: updated.payload,
    });
    await this.revisionPort.recordEntityRevision(updated, 'updated', plan.intent.actorUserId);
    await this.auditPort.record(
      plan.intent.actorUserId,
      `relationship.${plan.intent.operation}`,
      'entity',
      entity.id,
      entity.parentNodeId,
      entityAuditSnapshot(entity),
      entityAuditSnapshot(updated),
    );
    return { domain: 'entity', resource: updated };
  }
}

function relationValue(
  cardinality: 'one' | 'many',
  targetIds: readonly string[],
): string | string[] | null {
  return cardinality === 'many' ? [...targetIds] : targetIds[0] ?? null;
}
