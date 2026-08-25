import { ValidationError } from '../../domain/errors/ApplicationErrors.js';
import { EntityNotFoundError, EntityTypeNotFoundError } from '../../domain/errors/EntityErrors.js';
import { NodeNotFoundError, NodeTypeNotFoundError, RowVersionMismatchError } from '../../domain/errors/DomainErrors.js';
import type { MutateResourceRelationshipCommand } from '../commands/ResourceRelationshipCommands.js';
import { MutateResourceRelationshipCommandSchema } from '../commands/ResourceRelationshipCommands.js';
import type { AccessControlPort } from '../ports/AccessControlPort.js';
import type { AuditPort } from '../ports/AuditPort.js';
import type { EntityRepository } from '../ports/EntityRepository.js';
import type { EntityTypeRepository } from '../ports/EntityTypeRepository.js';
import type { NodeRepository } from '../ports/NodeRepository.js';
import type { NodeTypeRepository } from '../ports/NodeTypeRepository.js';
import type { ResourceRelationshipRepository } from '../ports/ResourceRelationshipRepository.js';
import type { RevisionPort } from '../ports/RevisionPort.js';
import type { RuntimeConfigurationPort } from '../ports/RuntimeConfigurationPort.js';
import type { TransactionPort } from '../ports/TransactionPort.js';
import type { TypeDefinitionReader } from '../ports/TypeDefinitionReader.js';
import type { TypeDomain, TypeFieldDefinition } from '../dto/TypeFieldDefinition.js';
import type { LockService } from './LockService.js';
import {
  normalizeRelationValue,
} from './ResourceRelationshipService.js';
import type { ResourceRelationshipService } from './ResourceRelationshipService.js';
import { entityAuditSnapshot, nodeAuditSnapshot } from './ResourceAuditSnapshot.js';
import type { Entity } from '../../domain/models/Entity.js';
import type { Node } from '../../domain/models/Node.js';

export type RelationshipMutationResource =
  | { domain: 'node'; resource: Node }
  | { domain: 'entity'; resource: Entity };

export interface RelationshipMutationResult {
  changedResources: RelationshipMutationResource[];
}

/**
 * Applies a relationship action to many source resources as one transaction.
 *
 * Normal resource edits still require an owned edit lock. A batch relation
 * action has no per-source edit surface, so it instead refuses any source
 * currently locked by another session and always checks its submitted
 * rowVersion. This makes the exception explicit and prevents the operation
 * from silently overwriting an open form.
 */
export class ResourceRelationshipMutationService {
  constructor(
    private readonly relationshipRepository: ResourceRelationshipRepository,
    private readonly relationshipService: ResourceRelationshipService,
    private readonly typeDefinitionReader: TypeDefinitionReader,
    private readonly nodeRepository: NodeRepository,
    private readonly entityRepository: EntityRepository,
    private readonly nodeTypeRepository: NodeTypeRepository,
    private readonly entityTypeRepository: EntityTypeRepository,
    private readonly accessControlPort: AccessControlPort,
    private readonly lockService: LockService,
    private readonly auditPort: AuditPort,
    private readonly revisionPort: RevisionPort,
    private readonly runtimeConfigPort: RuntimeConfigurationPort,
    private readonly transactionPort: TransactionPort,
  ) {}

  async mutate(command: MutateResourceRelationshipCommand): Promise<RelationshipMutationResult> {
    const validated = parseCommand(command);
    const definition = await this.typeDefinitionReader.readDefinition(
      validated.sourceDomain,
      validated.sourceTypeKey,
    );
    const field = definition?.fields.find((candidate) => candidate.fieldKey === validated.sourceFieldKey);
    if (!definition || !field || field.dataType.toLowerCase() !== 'relation' || !field.relationTarget || !field.id) {
      throw relationshipFieldUnavailable(validated.sourceFieldKey);
    }
    if (
      field.relationTarget.resourceType !== validated.targetDomain
      || field.relationTarget.typeKey === ''
    ) {
      throw relationshipFieldUnavailable(validated.sourceFieldKey);
    }

    await this.relationshipService.assertReadableTarget(
      validated.actorUserId,
      validated.targetDomain,
      field.relationTarget.typeKey,
      validated.targetResourceId,
      field.fieldKey,
    );

    if (field.relationTargetIsUnique && validated.operation === 'link' && validated.sources.length > 1) {
      throw new ValidationError('This relationship accepts only one source for the selected target.', {
        sources: ['The target is unique for this relationship.'],
      });
    }

    return this.transactionPort.runInTransaction(async () => {
      const changedResources: RelationshipMutationResource[] = [];
      for (const source of [...validated.sources].sort((left, right) => left.resourceId.localeCompare(right.resourceId))) {
        if (validated.sourceDomain === 'node') {
          const changed = await this.mutateNodeSource(validated, field, source.resourceId, source.expectedRowVersion);
          if (changed) changedResources.push({ domain: 'node', resource: changed });
        } else {
          const changed = await this.mutateEntitySource(validated, field, source.resourceId, source.expectedRowVersion);
          if (changed) changedResources.push({ domain: 'entity', resource: changed });
        }
      }
      return { changedResources };
    });
  }

  private async mutateNodeSource(
    command: MutateResourceRelationshipCommand,
    field: TypeFieldDefinition,
    sourceResourceId: string,
    expectedRowVersion: number,
  ): Promise<Node | null> {
    const [node, sourceType] = await Promise.all([
      this.nodeRepository.findById(sourceResourceId),
      this.nodeTypeRepository.findByKey(command.sourceTypeKey),
    ]);
    if (!node || node.deletedAt) throw new NodeNotFoundError(sourceResourceId);
    if (!sourceType || sourceType.id !== node.nodeTypeId || !sourceType.isActive) {
      throw new NodeTypeNotFoundError(command.sourceTypeKey);
    }
    if (node.rowVersion !== expectedRowVersion) {
      throw new RowVersionMismatchError(expectedRowVersion, node.rowVersion);
    }
    await this.accessControlPort.assertHasPermission(command.actorUserId, 'node.edit', node.id);

    const currentPayload = await this.relationshipService.hydratePayload(
      'node', node.id, sourceType.typeKey, node.payload,
    );
    const nextValue = nextRelationValue(
      currentPayload[field.fieldKey],
      field.relationSourceCardinality,
      command.operation,
      command.targetResourceId,
      field.fieldKey,
    );
    if (relationValueEquals(currentPayload[field.fieldKey], nextValue)) return null;

    await this.assertBatchMutationLock('node', node.id, command.actorUserId, command.actorSessionId);
    await this.assertTargetUniqueness(field, command, node.id);
    const updated = node.update(node.name, node.description, command.actorUserId, {
      ...currentPayload,
      [field.fieldKey]: nextValue,
    });
    await this.nodeRepository.update(updated);
    await this.relationshipService.synchronize({
      actorUserId: command.actorUserId,
      sourceDomain: 'node',
      sourceResourceId: updated.id,
      sourceTypeKey: sourceType.typeKey,
      payload: updated.payload,
    });
    await this.revisionPort.recordNodeRevision(updated, 'updated', command.actorUserId);
    await this.auditPort.record(
      command.actorUserId,
      `relationship.${command.operation}`,
      'node',
      node.id,
      node.id,
      nodeAuditSnapshot(node),
      nodeAuditSnapshot(updated),
    );
    return updated;
  }

  private async mutateEntitySource(
    command: MutateResourceRelationshipCommand,
    field: TypeFieldDefinition,
    sourceResourceId: string,
    expectedRowVersion: number,
  ): Promise<Entity | null> {
    const [entity, sourceType] = await Promise.all([
      this.entityRepository.findById(sourceResourceId),
      this.entityTypeRepository.findByKey(command.sourceTypeKey),
    ]);
    if (!entity || entity.deletedAt) throw new EntityNotFoundError(sourceResourceId);
    if (!sourceType || sourceType.id !== entity.entityTypeId || !sourceType.isActive) {
      throw new EntityTypeNotFoundError(command.sourceTypeKey, 'key');
    }
    if (entity.rowVersion !== expectedRowVersion) {
      throw new RowVersionMismatchError(expectedRowVersion, entity.rowVersion);
    }
    await this.accessControlPort.assertCanEditEntity(command.actorUserId, entity.id);

    const currentPayload = await this.relationshipService.hydratePayload(
      'entity', entity.id, sourceType.typeKey, entity.payload,
    );
    const nextValue = nextRelationValue(
      currentPayload[field.fieldKey],
      field.relationSourceCardinality,
      command.operation,
      command.targetResourceId,
      field.fieldKey,
    );
    if (relationValueEquals(currentPayload[field.fieldKey], nextValue)) return null;

    await this.assertBatchMutationLock('entity', entity.id, command.actorUserId, command.actorSessionId);
    await this.assertTargetUniqueness(field, command, entity.id);
    const updated = entity.update(entity.name, entity.description, {
      ...currentPayload,
      [field.fieldKey]: nextValue,
    }, command.actorUserId);
    await this.entityRepository.update(updated);
    await this.relationshipService.synchronize({
      actorUserId: command.actorUserId,
      sourceDomain: 'entity',
      sourceResourceId: updated.id,
      sourceTypeKey: sourceType.typeKey,
      payload: updated.payload,
    });
    await this.revisionPort.recordEntityRevision(updated, 'updated', command.actorUserId);
    await this.auditPort.record(
      command.actorUserId,
      `relationship.${command.operation}`,
      'entity',
      entity.id,
      entity.parentNodeId,
      entityAuditSnapshot(entity),
      entityAuditSnapshot(updated),
    );
    return updated;
  }

  private async assertBatchMutationLock(
    resourceType: TypeDomain,
    resourceId: string,
    actorUserId: string,
    actorSessionId: string,
  ): Promise<void> {
    if (!(await this.runtimeConfigPort.isCapabilityEnabled('locking'))) return;
    await this.lockService.requireLockIfNeeded(
      { resourceType, resourceId },
      actorUserId,
      actorSessionId,
    );
  }

  private async assertTargetUniqueness(
    field: TypeFieldDefinition,
    command: MutateResourceRelationshipCommand,
    sourceResourceId: string,
  ): Promise<void> {
    if (!field.id || !field.relationTargetIsUnique || command.operation !== 'link') return;
    const existing = await this.relationshipRepository.listIncoming(
      command.targetDomain,
      command.targetResourceId,
    );
    if (existing.some((edge) => edge.sourceFieldId === field.id && edge.sourceResourceId !== sourceResourceId)) {
      throw new ValidationError('The selected target is already linked by another source.', {
        [field.fieldKey]: ['The target is unique for this relationship.'],
      });
    }
  }
}

function parseCommand(command: MutateResourceRelationshipCommand): MutateResourceRelationshipCommand {
  const result = MutateResourceRelationshipCommandSchema.safeParse(command);
  if (result.success) return result.data;
  const issues: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join('.') || 'root';
    (issues[path] ??= []).push(issue.message);
  }
  throw new ValidationError('Relationship mutation validation failed.', issues);
}

function nextRelationValue(
  currentValue: unknown,
  cardinality: 'one' | 'many',
  operation: 'link' | 'unlink',
  targetResourceId: string,
  fieldKey: string,
): string | string[] | null {
  const currentIds = normalizeRelationValue(currentValue, cardinality, fieldKey);
  if (cardinality === 'one') {
    if (operation === 'link') return targetResourceId;
    return currentIds[0] === targetResourceId ? null : currentIds[0] ?? null;
  }
  return operation === 'link'
    ? [...new Set([...currentIds, targetResourceId])]
    : currentIds.filter((id) => id !== targetResourceId);
}

function relationValueEquals(currentValue: unknown, nextValue: string | string[] | null): boolean {
  if (Array.isArray(nextValue)) {
    return Array.isArray(currentValue)
      && currentValue.length === nextValue.length
      && currentValue.every((value, index) => value === nextValue[index]);
  }
  return currentValue === nextValue;
}

function relationshipFieldUnavailable(fieldKey: string): ValidationError {
  return new ValidationError('The requested relationship field is unavailable.', {
    [fieldKey]: ['The relationship field is unavailable.'],
  });
}
