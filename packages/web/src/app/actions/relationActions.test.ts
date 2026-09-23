/** Ensures expected relationship failures cross the Server Action boundary as data. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@dashboard/core';

const mocks = vi.hoisted(() => ({
  resolveActorUserId: vi.fn(),
  findNodeType: vi.fn(),
  getNodeById: vi.fn(),
}));

vi.mock('../../server/db', () => ({
  nodeTypeRepository: { findByKey: mocks.findNodeType },
  nodeService: { getNodeById: mocks.getNodeById },
  entityService: { getEntityById: vi.fn() },
  entityTypeRepository: { findByKey: vi.fn() },
  resourceRelationshipDefinitionReader: { listIncomingDefinitions: vi.fn() },
  resourceRelationshipRepository: { listIncoming: vi.fn() },
}));

vi.mock('./auth/AuthResolver', () => ({
  AuthResolver: { resolveActorUserId: mocks.resolveActorUserId },
}));

import { listIncomingRelationshipsAction } from './relationActions';

describe('listIncomingRelationshipsAction', () => {
  beforeEach(() => {
    mocks.resolveActorUserId.mockReset();
    mocks.findNodeType.mockReset();
    mocks.getNodeById.mockReset();
    mocks.resolveActorUserId.mockResolvedValue('actor-1');
    mocks.findNodeType.mockResolvedValue(null);
    mocks.getNodeById.mockResolvedValue(null);
  });

  it('returns a validation result for a target that does not match its requested type', async () => {
    await expect(listIncomingRelationshipsAction({
      targetDomain: 'node',
      targetTypeKey: 'task-record',
      targetResourceId: 'missing-resource',
    })).resolves.toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'The requested target resource is unavailable.',
      },
    });
  });

  it('returns an authorization result instead of throwing when the actor is denied', async () => {
    mocks.resolveActorUserId.mockRejectedValue(new ForbiddenError());

    await expect(listIncomingRelationshipsAction({
      targetDomain: 'node',
      targetTypeKey: 'task-record',
      targetResourceId: 'resource-1',
    })).resolves.toMatchObject({
      success: false,
      error: { code: 'ACCESS_FORBIDDEN' },
    });
  });

  it('keeps unexpected infrastructure failures generic and safe for the client', async () => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.resolveActorUserId.mockRejectedValue(new Error('database host leaked'));

    await expect(listIncomingRelationshipsAction({
      targetDomain: 'node',
      targetTypeKey: 'task-record',
      targetResourceId: 'resource-1',
    })).resolves.toEqual({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Si è verificato un errore interno. Riprova più tardi.',
        messageKey: 'errors.internal',
      },
    });
    expect(report).toHaveBeenCalled();
    report.mockRestore();
  });
});
