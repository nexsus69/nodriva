// Purpose: verifies node action authorization and safe structured mutation errors.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError, RowVersionMismatchError, UnauthorizedError, ValidationError } from '@dashboard/core';

const mocks = vi.hoisted(() => ({
  resolveActorUserId: vi.fn(),
  resolveActorIdentity: vi.fn(),
  assertCanReadNode: vi.fn(),
  createNode: vi.fn(),
  updateNode: vi.fn(),
  moveNode: vi.fn(),
  deleteNode: vi.fn(),
  getNodeById: vi.fn(),
  assertHasPermission: vi.fn(),
  isLocked: vi.fn(),
  lock: vi.fn(),
  unlock: vi.fn(),
  isCapabilityEnabled: vi.fn(),
}));

vi.mock('../../server/db', () => ({
  accessControlPort: { assertCanReadNode: mocks.assertCanReadNode, assertHasPermission: mocks.assertHasPermission },
  nodeService: {
    createNode: mocks.createNode,
    updateNode: mocks.updateNode,
    moveNode: mocks.moveNode,
    deleteNode: mocks.deleteNode,
    getNodeById: mocks.getNodeById,
  },
  lockService: { isLocked: mocks.isLocked, lock: mocks.lock, unlock: mocks.unlock },
  runtimeConfigPort: { isCapabilityEnabled: mocks.isCapabilityEnabled },
}));

vi.mock('../../server/realtime', () => ({
  runWithRealtimeOutbox: (operation: () => Promise<unknown>) => operation(),
}));

vi.mock('./auth/AuthResolver', () => ({
  AuthResolver: {
    resolveActorUserId: mocks.resolveActorUserId,
    resolveActorIdentity: mocks.resolveActorIdentity,
  },
}));

import { checkNodeReadAccessAction, createNodeAction, deleteNodeAction, moveNodeAction, updateNodeAction } from './nodeActions';

describe('checkNodeReadAccessAction', () => {
  beforeEach(() => {
    mocks.resolveActorUserId.mockReset().mockResolvedValue('actor-1');
    mocks.assertCanReadNode.mockReset().mockResolvedValue(undefined);
    mocks.resolveActorIdentity.mockReset().mockResolvedValue({ userId: 'actor-1', sessionId: 'session-1' });
    mocks.createNode.mockReset();
    mocks.updateNode.mockReset();
    mocks.moveNode.mockReset();
    mocks.deleteNode.mockReset();
    mocks.getNodeById.mockReset().mockResolvedValue(null);
    mocks.assertHasPermission.mockReset().mockResolvedValue(undefined);
    mocks.isLocked.mockReset().mockResolvedValue({ locked: false });
    mocks.lock.mockReset().mockResolvedValue(undefined);
    mocks.unlock.mockReset();
    mocks.isCapabilityEnabled.mockReset().mockResolvedValue(false);
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
    mocks.moveNode.mockReset();
    mocks.deleteNode.mockReset();
    mocks.getNodeById.mockReset().mockResolvedValue(null);
    mocks.assertHasPermission.mockReset().mockResolvedValue(undefined);
    mocks.isLocked.mockReset().mockResolvedValue({ locked: false });
    mocks.lock.mockReset().mockResolvedValue(undefined);
    mocks.unlock.mockReset();
    mocks.isCapabilityEnabled.mockReset().mockResolvedValue(false);
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

  it('returns a row-version result instead of rejecting a node move form', async () => {
    mocks.moveNode.mockRejectedValue(new RowVersionMismatchError(2, 3));

    await expect(moveNodeAction({ nodeId: 'node-1', newParentNodeId: 'parent-2', expectedNodeRowVersion: 2 }))
      .resolves.toMatchObject({
        success: false,
        error: { code: 'ROW_VERSION_MISMATCH', expectedRowVersion: 2, currentRowVersion: 3 },
      });
  });

  it('deletes a node through the safe action boundary and releases its owned lock', async () => {
    mocks.getNodeById.mockResolvedValue({ id: 'node-1', parentId: null, rowVersion: 3 });
    mocks.deleteNode.mockResolvedValue(undefined);
    mocks.isCapabilityEnabled.mockResolvedValue(true);

    await expect(deleteNodeAction({ nodeId: 'node-1', expectedRowVersion: 3 }))
      .resolves.toEqual({ success: true, data: { deleted: true, parentNodeId: null } });

    expect(mocks.deleteNode).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: 'actor-1', actorSessionId: 'session-1', nodeId: 'node-1', expectedRowVersion: 3,
    }));
    expect(mocks.unlock).toHaveBeenCalledWith(
      { resourceType: 'node', resourceId: 'node-1' },
      'actor-1',
      'session-1',
      { scopeNodeId: 'node-1' },
    );
  });

  it('resolves row version and transient lock server-side when a resource menu supplies only the UUID', async () => {
    mocks.getNodeById.mockResolvedValue({ id: 'node-1', parentId: 'parent-1', rowVersion: 7 });
    mocks.deleteNode.mockResolvedValue(undefined);
    mocks.isCapabilityEnabled.mockResolvedValue(true);

    await expect(deleteNodeAction({ nodeId: 'node-1' }))
      .resolves.toEqual({ success: true, data: { deleted: true, parentNodeId: 'parent-1' } });

    expect(mocks.lock).toHaveBeenCalledWith(
      { resourceType: 'node', resourceId: 'node-1' },
      'actor-1',
      'session-1',
      undefined,
      { scopeNodeId: 'node-1' },
    );
    expect(mocks.deleteNode).toHaveBeenCalledWith(expect.objectContaining({ expectedRowVersion: 7 }));
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
