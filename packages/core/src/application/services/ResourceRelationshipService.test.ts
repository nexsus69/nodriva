/** Verifies canonical relationship synchronization and payload hydration behavior. */

import { describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../../domain/errors/ApplicationErrors.js';
import { TypeDefinition, TypeFieldDefinition } from '../dto/TypeFieldDefinition.js';
import { ResourceRelationshipService } from './ResourceRelationshipService.js';

const sourceType = new TypeDefinition(
  'source-type',
  'entity',
  'task',
  'Task',
  '',
  1,
  [new TypeFieldDefinition(
    'dependsOn',
    'relation',
    false,
    [],
    'entity',
    'task',
    [],
    'static',
    'relation-field',
    'Depends on',
  )],
);

function createService() {
  const relationshipRepository = {
    listOutgoing: vi.fn(),
    listIncoming: vi.fn(),
    replaceValues: vi.fn(),
    removeForResource: vi.fn(),
  };
  const service = new ResourceRelationshipService(
    relationshipRepository,
    { readDefinition: vi.fn().mockResolvedValue(sourceType) },
    { findById: vi.fn() } as never,
    {
      findById: vi.fn().mockResolvedValue({
        id: '33333333-3333-4333-8333-333333333333',
        entityTypeId: 'task-type',
        parentNodeId: '44444444-4444-4444-8444-444444444444',
      }),
    } as never,
    { findByKey: vi.fn(), findById: vi.fn(), listAll: vi.fn() } as never,
    {
      findByKey: vi.fn().mockResolvedValue({ id: 'task-type' }),
      findById: vi.fn(),
      listAll: vi.fn(),
    } as never,
    { assertHasPermission: vi.fn(), assertCanReadNode: vi.fn() } as never,
  );
  return { service, relationshipRepository };
}

describe('ResourceRelationshipService', () => {
  it('validates a typed target and replaces the canonical field value', async () => {
    const { service, relationshipRepository } = createService();

    await service.synchronize({
      actorUserId: '11111111-1111-4111-8111-111111111111',
      sourceDomain: 'entity',
      sourceResourceId: '22222222-2222-4222-8222-222222222222',
      sourceTypeKey: 'task',
      payload: { dependsOn: '33333333-3333-4333-8333-333333333333' },
    });

    expect(relationshipRepository.replaceValues).toHaveBeenCalledWith(expect.objectContaining({
      sourceFieldId: 'relation-field',
      targetResourceIds: ['33333333-3333-4333-8333-333333333333'],
      sourceCardinality: 'one',
    }));
  });

  it('rejects a scalar relationship value that is not a UUID', async () => {
    const { service } = createService();

    await expect(service.synchronize({
      actorUserId: '11111111-1111-4111-8111-111111111111',
      sourceDomain: 'entity',
      sourceResourceId: '22222222-2222-4222-8222-222222222222',
      sourceTypeKey: 'task',
      payload: { dependsOn: 'not-a-resource' },
    })).rejects.toBeInstanceOf(ValidationError);
  });
});
