/** Covers the facade contract for relationship previews and atomic mutations. */

import { describe, expect, it, vi } from 'vitest';
import { Entity } from '../../domain/models/Entity.js';
import { EntityType } from '../../domain/models/EntityType.js';
import { TypeDefinition, TypeFieldDefinition } from '../dto/TypeFieldDefinition.js';
import { ValidationError } from '../../domain/errors/ApplicationErrors.js';
import { ResourceRelationshipMutationService } from './ResourceRelationshipMutationService.js';

const actorUserId = '11111111-1111-4111-8111-111111111111';
const actorSessionId = '22222222-2222-4222-8222-222222222222';
const targetResourceId = '33333333-3333-4333-8333-333333333333';
const previousTargetResourceId = '99999999-9999-4999-8999-999999999999';
const firstSourceId = '44444444-4444-4444-8444-444444444444';
const secondSourceId = '55555555-5555-4555-8555-555555555555';

function relationshipField(
  targetIsUnique = false,
  sourceCardinality: 'one' | 'many' = 'many',
): TypeFieldDefinition {
  return new TypeFieldDefinition(
    'documents',
    'relation',
    false,
    [],
    'entity',
    'document',
    [],
    'static',
    'task-documents-field',
    'Documents',
    'plaintext',
    sourceCardinality,
    targetIsUnique,
  );
}

function sourceEntity(id: string, rowVersion = 3, documents: string | string[] | null = []): Entity {
  return new Entity(
    id,
    'task-type-id',
    '66666666-6666-4666-8666-666666666666',
    `Task ${id}`,
    '',
    rowVersion,
    new Date('2026-01-01T00:00:00.000Z'),
    new Date('2026-01-01T00:00:00.000Z'),
    null,
    actorUserId,
    actorUserId,
    { documents },
  );
}

function createService(field = relationshipField(), firstSourceDocuments: string | string[] | null = []) {
  const entities = new Map([
    [firstSourceId, sourceEntity(firstSourceId, 3, firstSourceDocuments)],
    [secondSourceId, sourceEntity(secondSourceId)],
  ]);
  const relationshipRepository = {
    listOutgoing: vi.fn(),
    listIncoming: vi.fn().mockResolvedValue([]),
    replaceValues: vi.fn(),
    removeForResource: vi.fn(),
    listActiveOutgoing: vi.fn().mockResolvedValue([]),
    listActiveOutgoingForSources: vi.fn().mockResolvedValue([]),
    listActiveIncomingForTargets: vi.fn().mockResolvedValue([]),
    suspendActiveOutgoingForSources: vi.fn(),
    restoreSuspendedOutgoingForSources: vi.fn(),
    assertTargetsActive: vi.fn(),
    lockActiveTargets: vi.fn(),
  };
  const relationshipService = {
    assertReadableTarget: vi.fn(),
    hydratePayload: vi.fn(async (_domain: string, resourceId: string) => entities.get(resourceId)?.payload ?? {}),
    hydratePayloadForPersistence: vi.fn(async (_domain: string, resourceId: string) => entities.get(resourceId)?.payload ?? {}),
    synchronize: vi.fn(),
  };
  const entityRepository = {
    findById: vi.fn(async (id: string) => entities.get(id) ?? null),
    update: vi.fn(async (entity: Entity) => { entities.set(entity.id, entity); }),
  };
  const auditPort = { record: vi.fn() };
  const revisionPort = { recordEntityRevision: vi.fn(), recordNodeRevision: vi.fn() };
  const service = new ResourceRelationshipMutationService(
    relationshipRepository,
    relationshipService as never,
    {
      readDefinition: vi.fn().mockResolvedValue(new TypeDefinition(
        'task-type-id', 'entity', 'task', 'Task', '', 1, [field],
      )),
    },
    { findById: vi.fn() } as never,
    entityRepository as never,
    { findByKey: vi.fn() } as never,
    {
      findByKey: vi.fn().mockResolvedValue(new EntityType('task-type-id', 'task', 'Task', '', 'entity_task', 1, true)),
    } as never,
    { assertCanEditEntity: vi.fn(), assertHasPermission: vi.fn() } as never,
    { isLocked: vi.fn().mockResolvedValue({ locked: false }), requireLockIfNeeded: vi.fn() } as never,
    auditPort,
    revisionPort,
    { isCapabilityEnabled: vi.fn().mockResolvedValue(true) } as never,
    {
      runInTransaction: async <T>(work: () => Promise<T>) => work(),
      runInAuthorizationMutation: async <T>(work: () => Promise<T>) => work(),
    },
  );
  return { service, entityRepository, relationshipService, auditPort, revisionPort };
}

describe('ResourceRelationshipMutationService', () => {
  it('links all submitted source resources through the normal canonical synchronization path', async () => {
    const { service, entityRepository, relationshipService, auditPort, revisionPort } = createService();

    const result = await service.mutate({
      actorUserId,
      actorSessionId,
      sourceDomain: 'entity',
      sourceTypeKey: 'task',
      sourceFieldKey: 'documents',
      targetDomain: 'entity',
      targetResourceId,
      operation: 'link',
      sources: [
        { resourceId: secondSourceId, expectedRowVersion: 3 },
        { resourceId: firstSourceId, expectedRowVersion: 3 },
      ],
    });

    expect(result.changedResources).toHaveLength(2);
    expect(entityRepository.update).toHaveBeenCalledTimes(2);
    expect(relationshipService.synchronize).toHaveBeenCalledTimes(2);
    expect(relationshipService.synchronize).toHaveBeenCalledWith(expect.objectContaining({
      payload: { documents: [targetResourceId] },
    }));
    expect(revisionPort.recordEntityRevision).toHaveBeenCalledTimes(2);
    expect(auditPort.record).toHaveBeenCalledTimes(2);
  });

  it('rejects a multi-source link when the target side is unique before any update', async () => {
    const { service, entityRepository } = createService(relationshipField(true));

    await expect(service.mutate({
      actorUserId,
      actorSessionId,
      sourceDomain: 'entity',
      sourceTypeKey: 'task',
      sourceFieldKey: 'documents',
      targetDomain: 'entity',
      targetResourceId,
      operation: 'link',
      sources: [
        { resourceId: firstSourceId, expectedRowVersion: 3 },
        { resourceId: secondSourceId, expectedRowVersion: 3 },
      ],
    })).rejects.toBeInstanceOf(ValidationError);

    expect(entityRepository.update).not.toHaveBeenCalled();
  });

  it('previews a single-value replacement and requires explicit confirmation before committing it', async () => {
    const { service, entityRepository } = createService(relationshipField(false, 'one'), previousTargetResourceId);
    const command = {
      actorUserId,
      actorSessionId,
      sourceDomain: 'entity' as const,
      sourceTypeKey: 'task',
      sourceFieldKey: 'documents',
      targetDomain: 'entity' as const,
      targetResourceId,
      operation: 'link' as const,
      sources: [{ resourceId: firstSourceId, expectedRowVersion: 3 }],
    };

    const preview = await service.prepare(command);
    expect(preview.replacementSourceIds).toEqual([firstSourceId]);
    expect(preview.items[0]?.impact).toMatchObject({
      kind: 'replace',
      beforeTargetIds: [previousTargetResourceId],
      afterTargetIds: [targetResourceId],
      requiresConfirmation: true,
    });

    await expect(service.mutate(command)).rejects.toBeInstanceOf(ValidationError);
    expect(entityRepository.update).not.toHaveBeenCalled();

    await service.mutate({
      ...command,
      acceptedReplacementSourceIds: [firstSourceId],
    });
    expect(entityRepository.update).toHaveBeenCalledTimes(1);
  });
});
