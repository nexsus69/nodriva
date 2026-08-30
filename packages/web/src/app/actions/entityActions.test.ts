// Purpose: verifies UUID-only entity deletion keeps authorization, locking and row-version checks server-side.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveActorIdentity: vi.fn(),
  assertCanDeleteEntity: vi.fn(),
  getEntityById: vi.fn(),
  deleteEntity: vi.fn(),
  isCapabilityEnabled: vi.fn(),
  isLocked: vi.fn(),
  lock: vi.fn(),
  unlock: vi.fn(),
}));

vi.mock('../../server/db', () => ({
  accessControlPort: { assertCanDeleteEntity: mocks.assertCanDeleteEntity },
  entityService: { getEntityById: mocks.getEntityById, deleteEntity: mocks.deleteEntity },
  runtimeConfigPort: { isCapabilityEnabled: mocks.isCapabilityEnabled },
  lockService: { isLocked: mocks.isLocked, lock: mocks.lock, unlock: mocks.unlock },
}));

vi.mock('../../server/realtime', () => ({
  runWithRealtimeOutbox: (operation: () => Promise<unknown>) => operation(),
}));

vi.mock('./auth/AuthResolver', () => ({
  AuthResolver: { resolveActorIdentity: mocks.resolveActorIdentity },
}));

import { deleteEntityAction } from './entityActions';

describe('entity deletion action', () => {
  beforeEach(() => {
    mocks.resolveActorIdentity.mockReset().mockResolvedValue({ userId: 'actor-1', sessionId: 'session-1' });
    mocks.assertCanDeleteEntity.mockReset().mockResolvedValue(undefined);
    mocks.getEntityById.mockReset().mockResolvedValue({ id: 'entity-1', parentNodeId: 'node-1', entityTypeId: 'task', rowVersion: 4 });
    mocks.deleteEntity.mockReset().mockResolvedValue(undefined);
    mocks.isCapabilityEnabled.mockReset().mockResolvedValue(true);
    mocks.isLocked.mockReset().mockResolvedValue({ locked: false });
    mocks.lock.mockReset().mockResolvedValue(undefined);
    mocks.unlock.mockReset().mockResolvedValue(undefined);
  });

  it('accepts only the UUID from a resource menu and resolves protected mutation inputs on the server', async () => {
    await expect(deleteEntityAction({ entityId: 'entity-1' }))
      .resolves.toEqual({ success: true, data: { deleted: true, parentNodeId: 'node-1', entityTypeId: 'task' } });

    expect(mocks.assertCanDeleteEntity).toHaveBeenCalledWith('actor-1', 'entity-1');
    expect(mocks.lock).toHaveBeenCalledWith(
      { resourceType: 'entity', resourceId: 'entity-1' },
      'actor-1',
      'session-1',
      undefined,
      { scopeNodeId: 'node-1' },
    );
    expect(mocks.deleteEntity).toHaveBeenCalledWith(expect.objectContaining({ expectedRowVersion: 4 }));
  });
});
