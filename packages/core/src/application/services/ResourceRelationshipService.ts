import { ValidationError } from '../../domain/errors/ApplicationErrors.js';
import type { AccessControlPort } from '../ports/AccessControlPort.js';
import type { EntityRepository } from '../ports/EntityRepository.js';
import type { EntityTypeRepository } from '../ports/EntityTypeRepository.js';
import type { NodeRepository } from '../ports/NodeRepository.js';
import type { NodeTypeRepository } from '../ports/NodeTypeRepository.js';
import type { ResourceRelationshipRepository } from '../ports/ResourceRelationshipRepository.js';
import type { TypeDefinitionReader } from '../ports/TypeDefinitionReader.js';
import type { TypeDomain } from '../dto/TypeFieldDefinition.js';

export interface SynchronizeResourceRelationshipsInput {
  actorUserId: string;
  sourceDomain: TypeDomain;
  sourceResourceId: string;
  sourceTypeKey: string;
  payload: Readonly<Record<string, unknown>>;
}

/**
 * Application-level relationship coordinator. It validates typed targets and
 * access rights before replacing canonical edges inside the caller's
 * transaction. It deliberately has no UI or SQL dependencies.
 */
export class ResourceRelationshipService {
  constructor(
    private readonly relationshipRepository: ResourceRelationshipRepository,
    private readonly typeDefinitionReader: TypeDefinitionReader,
    private readonly nodeRepository: NodeRepository,
    private readonly entityRepository: EntityRepository,
    private readonly nodeTypeRepository: NodeTypeRepository,
    private readonly entityTypeRepository: EntityTypeRepository,
    private readonly accessControlPort: AccessControlPort,
  ) {}

  async synchronize(input: SynchronizeResourceRelationshipsInput): Promise<void> {
    const definition = await this.typeDefinitionReader.readDefinition(input.sourceDomain, input.sourceTypeKey);
    if (!definition) {
      throw new ValidationError(`The source type '${input.sourceTypeKey}' is unavailable.`, {
        sourceTypeKey: ['The source type is unavailable.'],
      });
    }

    for (const field of definition.fields) {
      if (field.dataType.toLowerCase() !== 'relation' || !field.relationTarget || !field.id) continue;

      const targetIds = normalizeRelationValue(
        input.payload[field.fieldKey],
        field.relationSourceCardinality,
        field.fieldKey,
      );

      for (const targetId of targetIds) {
        await this.assertReadableTypedTarget(
          input.actorUserId,
          field.relationTarget.resourceType,
          field.relationTarget.typeKey,
          targetId,
          field.fieldKey,
        );
      }

      // The adapter holds a compatible database lock (PostgreSQL) or the
      // standalone write transaction (SQLite) until replaceValues completes.
      await this.relationshipRepository.assertTargetsActive(field.relationTarget.resourceType, targetIds);

      await this.relationshipRepository.replaceValues({
        sourceFieldId: field.id,
        sourceDomain: input.sourceDomain,
        sourceResourceId: input.sourceResourceId,
        targetDomain: field.relationTarget.resourceType,
        targetResourceIds: targetIds,
        sourceCardinality: field.relationSourceCardinality,
        targetIsUnique: field.relationTargetIsUnique,
      });
    }
  }

  /** Validates that an actor can read a concrete target of the declared type. */
  async assertReadableTarget(
    actorUserId: string,
    targetDomain: TypeDomain,
    targetTypeKey: string,
    targetId: string,
    fieldKey: string,
  ): Promise<void> {
    await this.assertReadableTypedTarget(
      actorUserId,
      targetDomain,
      targetTypeKey,
      targetId,
      fieldKey,
    );
  }

  /** Rehydrates relation values from canonical edges for an authorized resource read. */
  async hydratePayload(
    actorUserId: string,
    sourceDomain: TypeDomain,
    sourceResourceId: string,
    sourceTypeKey: string,
    payload: Readonly<Record<string, unknown>>,
  ): Promise<Record<string, unknown>> {
    return this.hydratePayloadInternal(actorUserId, sourceDomain, sourceResourceId, sourceTypeKey, payload);
  }

  /** Internal lifecycle projection: retains every active target and must never feed a user read model. */
  async hydratePayloadForPersistence(
    sourceDomain: TypeDomain,
    sourceResourceId: string,
    sourceTypeKey: string,
    payload: Readonly<Record<string, unknown>>,
  ): Promise<Record<string, unknown>> {
    return this.hydratePayloadInternal(undefined, sourceDomain, sourceResourceId, sourceTypeKey, payload);
  }

  private async hydratePayloadInternal(
    actorUserId: string | undefined,
    sourceDomain: TypeDomain,
    sourceResourceId: string,
    sourceTypeKey: string,
    payload: Readonly<Record<string, unknown>>,
  ): Promise<Record<string, unknown>> {
    const definition = await this.typeDefinitionReader.readDefinition(sourceDomain, sourceTypeKey);
    if (!definition) return { ...payload };

    const edges = await this.relationshipRepository.listActiveOutgoing(sourceDomain, sourceResourceId);
    const [activeNodeIds, activeEntityIds] = await Promise.all([
      this.nodeRepository.listActiveIds(edges.filter((edge) => edge.targetDomain === 'node').map((edge) => edge.targetResourceId)),
      this.entityRepository.listActiveIds(edges.filter((edge) => edge.targetDomain === 'entity').map((edge) => edge.targetResourceId)),
    ]);
    const resolver = this.accessControlPort.listReadableResourceIds;
    const [readableNodeIds, readableEntityIds] = actorUserId && resolver
      ? await Promise.all([
        resolver.call(this.accessControlPort, actorUserId, 'node', activeNodeIds),
        resolver.call(this.accessControlPort, actorUserId, 'entity', activeEntityIds),
      ])
      : actorUserId ? [[], []] : [activeNodeIds, activeEntityIds];
    const activeTargetIds = new Set([...readableNodeIds, ...readableEntityIds]);
    const edgesByField = new Map<string, string[]>();
    for (const edge of edges) {
      if (!activeTargetIds.has(edge.targetResourceId)) continue;
      const values = edgesByField.get(edge.sourceFieldId) ?? [];
      values.push(edge.targetResourceId);
      edgesByField.set(edge.sourceFieldId, values);
    }

    const hydrated = { ...payload };
    for (const field of definition.fields) {
      if (field.dataType.toLowerCase() !== 'relation' || !field.id) continue;
      const targetIds = edgesByField.get(field.id) ?? [];
      hydrated[field.fieldKey] = field.relationSourceCardinality === 'many'
        ? targetIds
        : targetIds[0] ?? null;
    }
    return hydrated;
  }

  private async assertReadableTypedTarget(
    actorUserId: string,
    targetDomain: TypeDomain,
    targetTypeKey: string,
    targetId: string,
    fieldKey: string,
  ): Promise<void> {
    if (targetDomain === 'node') {
      const [targetType, target] = await Promise.all([
        this.nodeTypeRepository.findByKey(targetTypeKey),
        this.nodeRepository.findById(targetId),
      ]);
      if (!targetType || !target || target.nodeTypeId !== targetType.id) {
        throw invalidTarget(fieldKey);
      }
      await this.accessControlPort.assertCanReadNode(actorUserId, target.id);
      return;
    }

    const [targetType, target] = await Promise.all([
      this.entityTypeRepository.findByKey(targetTypeKey),
      this.entityRepository.findById(targetId),
    ]);
    if (!targetType || !target || target.entityTypeId !== targetType.id) {
      throw invalidTarget(fieldKey);
    }
    await this.accessControlPort.assertHasPermission(actorUserId, 'entity.read', target.parentNodeId);
  }
}

/** Normalizes an externally supplied relation value into unique target ids. */
export function normalizeRelationValue(
  value: unknown,
  cardinality: 'one' | 'many',
  fieldKey: string,
): string[] {
  if (value === null || value === undefined || value === '') return [];

  const values = cardinality === 'many' ? value : [value];
  if (!Array.isArray(values) || values.some((candidate) => typeof candidate !== 'string' || !isUuid(candidate))) {
    throw new ValidationError(`Relation field '${fieldKey}' contains an invalid resource identifier.`, {
      [fieldKey]: ['Every relation target must be a valid resource identifier.'],
    });
  }
  return [...new Set(values)];
}

function invalidTarget(fieldKey: string): ValidationError {
  return new ValidationError(`The relation target for '${fieldKey}' is invalid or unavailable.`, {
    [fieldKey]: ['The target is invalid or unavailable.'],
  });
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
