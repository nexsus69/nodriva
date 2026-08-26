/** Verifies lock inspection and commit-time batch concurrency behavior. */

import { describe, expect, it, vi } from 'vitest';
import { BatchMutationConcurrencyGuard } from './BatchMutationConcurrencyGuard.js';

const actorUserId = '11111111-1111-4111-8111-111111111111';
const actorSessionId = '22222222-2222-4222-8222-222222222222';

describe('BatchMutationConcurrencyGuard', () => {
  it('reports only locks owned by another session as unavailable', async () => {
    const lockService = {
      isLocked: vi.fn()
        .mockResolvedValueOnce({ locked: true, byUserId: actorUserId, bySessionId: actorSessionId })
        .mockResolvedValueOnce({ locked: true, byUserId: actorUserId, bySessionId: '33333333-3333-4333-8333-333333333333' }),
      requireLockIfNeeded: vi.fn(),
    };
    const guard = new BatchMutationConcurrencyGuard(lockService as never, {
      isCapabilityEnabled: vi.fn().mockResolvedValue(true),
    } as never);

    await expect(guard.inspect([
      { domain: 'entity', resourceId: 'first' },
      { domain: 'entity', resourceId: 'second' },
    ], actorUserId, actorSessionId)).resolves.toEqual([
      { domain: 'entity', resourceId: 'first', available: true },
      { domain: 'entity', resourceId: 'second', available: false },
    ]);
  });

  it('uses the established lock service at commit time and does not acquire batch locks', async () => {
    const lockService = { isLocked: vi.fn(), requireLockIfNeeded: vi.fn() };
    const guard = new BatchMutationConcurrencyGuard(lockService as never, {
      isCapabilityEnabled: vi.fn().mockResolvedValue(true),
    } as never);

    await guard.assertAvailable([{ domain: 'node', resourceId: 'first' }], actorUserId, actorSessionId);

    expect(lockService.requireLockIfNeeded).toHaveBeenCalledWith(
      { resourceType: 'node', resourceId: 'first' }, actorUserId, actorSessionId,
    );
  });
});
