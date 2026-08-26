// Purpose: verifies node action authorization and safe structured mutation errors.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError, UnauthorizedError, ValidationError } from '@dashboard/core';

const mocks = vi.hoisted(() => ({
  resolveActorUserId: vi.fn(),
  resolveActorIdentity: vi.fn(),
  assertCanReadNode: vi.fn(),
  createNode: vi.fn(),
  updateNode: vi.fn(),
}));

vi.mock('../../server/db', () => ({
  accessControlPort: { assertCanReadNode: mocks.assertCanReadNode },
  nodeService: {
    createNode: mocks.createNode,
    updateNode: mocks.updateNode,
  },
}));

vi.mock('../../server/realtime', () => ({
  runWithRealtimeOutbox: (operation: () => Promise<unknown>) => operation(),
}));

vi.mock('../../server/adminRealtime', () => ({
  publishAuditRealtimeChange: vi.fn(),
}));

vi.mock('./auth/AuthResolver', () => ({
  AuthResolver: {
    resolveActorUserId: mocks.resolveActorUserId,
    resolveActorIdentity: mocks.resolveActorIdentity,
  },
}));

import { checkNodeReadAccessAction, createNodeAction, updateNodeAction } from './nodeActions';

describe('checkNodeReadAccessAction', () => {
  beforeEach(() => {
    mocks.resolveActorUserId.mockReset().mockResolvedValue('actor-1');
    mocks.assertCanReadNode.mockReset().mockResolvedValue(undefined);
    mocks.resolveActorIdentity.mockReset().mockResolvedValue({ userId: 'actor-1', sessionId: 'session-1' });
    mocks.createNode.mockReset();
    mocks.updateNode.mockReset();
  });

  it('allows an authorized node read', async () => {
    await expect(checkNodeReadAccessAction('node-1')).resolves.toBe(true);
  });

  it('returns false for an application authorization denial', async () => {
    mocks.assertCanReadNode.mockRejectedValue(new ForbiddenError());
    await expect(checkNodeReadAccessAction('node-1')).resolves.toBe(false);
  });

  it('returns false for an expired authentication session', async () => {
    mocks.resolveActorUserId.mockRejectedValue(new UnauthorizedError());
    await expect(checkNodeReadAccessAction('node-1')).resolves.toBe(false);
  });

  it('propagates infrastructure failures', async () => {
    const failure = new Error('database unavailable');
    mocks.assertCanReadNode.mockRejectedValue(failure);
    await expect(checkNodeReadAccessAction('node-1')).rejects.toBe(failure);
  });
});

describe('node mutation actions', () => {
  beforeEach(() => {
    mocks.resolveActorIdentity.mockReset().mockResolvedValue({ userId: 'actor-1', sessionId: 'session-1' });
    mocks.createNode.mockReset();
    mocks.updateNode.mockReset();
  });

  it('returns a validation result instead of rejecting a node create form', async () => {
    mocks.createNode.mockRejectedValue(new ValidationError('Validation failed for creating node.', {
      name: ['Il nome è obbligatorio.'],
    }));

    await expect(createNodeAction({ parentNodeId: null, nodeTypeKey: 'project', name: '' }))
      .resolves.toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Validation failed for creating node.' },
      });
  });

  it('returns an authorization result instead of rejecting a node update form', async () => {
    mocks.resolveActorIdentity.mockRejectedValue(new ForbiddenError());

    await expect(updateNodeAction({ nodeId: 'node-1', name: 'Nuovo nome', expectedRowVersion: 1 }))
      .resolves.toMatchObject({ success: false, error: { code: 'ACCESS_FORBIDDEN' } });
  });

  it('keeps unexpected node mutation failures generic and safe for the client', async () => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.createNode.mockRejectedValue(new Error('database host leaked'));

    await expect(createNodeAction({ parentNodeId: null, nodeTypeKey: 'project', name: 'Project' }))
      .resolves.toEqual({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Si è verificato un errore interno. Riprova più tardi.',
        },
      });
    expect(report).toHaveBeenCalled();
    report.mockRestore();
  });
});
