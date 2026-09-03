/** Builds validated, non-persistent plans for canonical relationship changes. */

import { ValidationError } from '../../domain/errors/ApplicationErrors.js';
import { EntityNotFoundError, EntityTypeNotFoundError } from '../../domain/errors/EntityErrors.js';
import { NodeNotFoundError, NodeTypeNotFoundError, RowVersionMismatchError } from '../../domain/errors/DomainErrors.js';
import { RelationshipMutationImpactPolicy } from '../../domain/policies/RelationshipMutationImpactPolicy.js';
import type { MutateResourceRelationshipCommand } from '../commands/ResourceRelationshipCommands.js';
import type {
  RelationshipMutationFieldPlan,
  RelationshipMutationPlan,
  RelationshipMutationPlanItem,
} from '../dto/RelationshipMutationPlan.js';
import type { AccessControlPort } from '../ports/AccessControlPort.js';
import type { EntityRepository } from '../ports/EntityRepository.js';
import type { EntityTypeRepository } from '../ports/EntityTypeRepository.js';
import type { NodeRepository } from '../ports/NodeRepository.js';
import type { NodeTypeRepository } from '../ports/NodeTypeRepository.js';
import type { ResourceRelationshipRepository } from '../ports/ResourceRelationshipRepository.js';
import type { TypeDefinitionReader } from '../ports/TypeDefinitionReader.js';
import { normalizeRelationValue, type ResourceRelationshipService } from './ResourceRelationshipService.js';

/**
 * Prepares a relationship change without persisting it.
 *
 * Preparation validates type, ACL, target visibility and source versions, then
 * delegates cardinality semantics to the pure impact policy. The returned plan
 * is a preview only: the caller must prepare it again in the commit transaction.
 */
export class RelationshipMutationPlanner {
  constructor(
    private readonly relationshipRepository: ResourceRelationshipRepository,
    private readonly relationshipService: ResourceRelationshipService,
    private readonly typeDefinitionReader: TypeDefinitionReader,
    private readonly nodeRepository: NodeRepository,
    private readonly entityRepository: EntityRepository,
    private readonly nodeTypeRepository: NodeTypeRepository,
    private readonly entityTypeRepository: EntityTypeRepository,
    private readonly accessControlPort: AccessControlPort,
    private readonly impactPolicy = new RelationshipMutationImpactPolicy(),
  ) {}

  async prepare(intent: MutateResourceRelationshipCommand): Promise<RelationshipMutationPlan> {
    const field = await this.readField(intent);
    await this.relationshipService.assertReadableTarget(
      intent.actorUserId,
      intent.targetDomain,
      field.targetTypeKey,
      intent.targetResourceId,
      field.key,
    );

    if (field.targetIsUnique && intent.operation === 'link' && intent.sources.length > 1) {
      throw new ValidationError('This relationship accepts only one source for the selected target.', {
        sources: ['The target is unique for this relationship.'],
      });
    }

    const items = await Promise.all(intent.sources.map((source) => this.prepareSource(intent, field, source)));
    await this.assertTargetUniqueness(intent, field, items);

    return {
      intent,
      field,
      items: items.sort((left, right) => left.resourceId.localeCompare(right.resourceId)),
      replacementSourceIds: items
        .filter((item) => item.impact.requiresConfirmation)
        .map((item) => item.resourceId)
        .sort(),
    };
  }

  private async readField(intent: MutateResourceRelationshipCommand): Promise<RelationshipMutationFieldPlan> {
    const definition = await this.typeDefinitionReader.readDefinition(intent.sourceDomain, intent.sourceTypeKey);
    const field = definition?.fields.find((candidate) => candidate.fieldKey === intent.sourceFieldKey);
    if (!definition || !field || field.dataType.toLowerCase() !== 'relation' || !field.relationTarget || !field.id) {
      throw relationshipFieldUnavailable(intent.sourceFieldKey);
    }
    if (field.relationTarget.resourceType !== intent.targetDomain || field.relationTarget.typeKey === '') {
      throw relationshipFieldUnavailable(intent.sourceFieldKey);
    }

    return {
      id: field.id,
      key: field.fieldKey,
      sourceCardinality: field.relationSourceCardinality,
      targetDomain: field.relationTarget.resourceType,
      targetTypeKey: field.relationTarget.typeKey,
      targetIsUnique: field.relationTargetIsUnique,
    };
  }

  private async prepareSource(
    intent: MutateResourceRelationshipCommand,
    field: RelationshipMutationFieldPlan,
    source: { resourceId: string; expectedRowVersion: number },
  ): Promise<RelationshipMutationPlanItem> {
    if (intent.sourceDomain === 'node') {
      const [node, sourceType] = await Promise.all([
        this.nodeRepository.findById(source.resourceId),
        this.nodeTypeRepository.findByKey(intent.sourceTypeKey),
      ]);
      if (!node || node.deletedAt) throw new NodeNotFoundError(source.resourceId);
      if (!sourceType || sourceType.id !== node.nodeTypeId || !sourceType.isActive) {
        throw new NodeTypeNotFoundError(intent.sourceTypeKey);
      }
      if (node.rowVersion !== source.expectedRowVersion) {
        throw new RowVersionMismatchError(source.expectedRowVersion, node.rowVersion);
      }
      await this.accessControlPort.assertHasPermission(intent.actorUserId, 'node.edit', node.id);
      return this.toPlanItem(
        field,
        source,
        node.rowVersion,
        await this.relationshipService.hydratePayloadForPersistence('node', node.id, sourceType.typeKey, node.payload),
        intent,
      );
    }

    const [entity, sourceType] = await Promise.all([
      this.entityRepository.findById(source.resourceId),
      this.entityTypeRepository.findByKey(intent.sourceTypeKey),
    ]);
    if (!entity || entity.deletedAt) throw new EntityNotFoundError(source.resourceId);
    if (!sourceType || sourceType.id !== entity.entityTypeId || !sourceType.isActive) {
      throw new EntityTypeNotFoundError(intent.sourceTypeKey, 'key');
    }
    if (entity.rowVersion !== source.expectedRowVersion) {
      throw new RowVersionMismatchError(source.expectedRowVersion, entity.rowVersion);
    }
    await this.accessControlPort.assertCanEditEntity(intent.actorUserId, entity.id);
    return this.toPlanItem(
      field,
      source,
      entity.rowVersion,
      await this.relationshipService.hydratePayloadForPersistence('entity', entity.id, sourceType.typeKey, entity.payload),
      intent,
    );
  }

  private toPlanItem(
    field: RelationshipMutationFieldPlan,
    source: { resourceId: string; expectedRowVersion: number },
    currentRowVersion: number,
    payload: Readonly<Record<string, unknown>>,
    intent: MutateResourceRelationshipCommand,
  ): RelationshipMutationPlanItem {
    const currentTargetIds = normalizeRelationValue(payload[field.key], field.sourceCardinality, field.key);
    return {
      resourceId: source.resourceId,
      expectedRowVersion: source.expectedRowVersion,
      currentRowVersion,
      impact: this.impactPolicy.evaluate({
        cardinality: field.sourceCardinality,
        operation: intent.operation,
        currentTargetIds,
        targetResourceId: intent.targetResourceId,
      }),
    };
  }

  private async assertTargetUniqueness(
    intent: MutateResourceRelationshipCommand,
    field: RelationshipMutationFieldPlan,
    items: readonly RelationshipMutationPlanItem[],
  ): Promise<void> {
    if (!field.targetIsUnique || intent.operation !== 'link') return;

    const existing = await this.relationshipRepository.listIncoming(intent.targetDomain, intent.targetResourceId);
    const sourceIds = new Set(items.map((item) => item.resourceId));
    const conflictingEdge = existing.find((edge) => edge.sourceFieldId === field.id && !sourceIds.has(edge.sourceResourceId));
    if (conflictingEdge) {
      throw new ValidationError('The selected target is already linked by another source.', {
        [field.key]: ['The target is unique for this relationship.'],
      });
    }
  }
}

function relationshipFieldUnavailable(fieldKey: string): ValidationError {
  return new ValidationError('The requested relationship field is unavailable.', {
    [fieldKey]: ['The relationship field is unavailable.'],
  });
}
