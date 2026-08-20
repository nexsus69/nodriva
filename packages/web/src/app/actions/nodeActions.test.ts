import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError, UnauthorizedError } from '@dashboard/core';

const mocks = vi.hoisted(() => ({
  resolveActorUserId: vi.fn(),
  assertCanReadNode: vi.fn(),
}));

vi.mock('../../server/db', () => ({
  accessControlPort: { assertCanReadNode: mocks.assertCanReadNode },
}));

vi.mock('./auth/AuthResolver', () => ({
  AuthResolver: {
    resolveActorUserId: mocks.resolveActorUserId,
    resolveActorIdentity: vi.fn(),
  },
}));

import { checkNodeReadAccessAction } from './nodeActions';

describe('checkNodeReadAccessAction', () => {
  beforeEach(() => {
    mocks.resolveActorUserId.mockReset().mockResolvedValue('actor-1');
    mocks.assertCanReadNode.mockReset().mockResolvedValue(undefined);
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
