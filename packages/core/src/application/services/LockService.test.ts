import { describe, expect, it, vi } from 'vitest';
import { LockService } from './LockService.js';
import { Lock } from '../../domain/models/Lock.js';
import {
  LockConflictError,
  LockExpiredError,
  LockNotFoundError,
} from '../../domain/errors/ApplicationErrors.js';
import { LockRepository } from '../ports/LockRepository.js';
import { LockEventBus } from '../ports/LockEventBus.js';

const RESOURCE_ID = '00000000-0000-0000-0000-000000000001';
const ACTOR_ID = '00000000-0000-0000-0000-000000000002';

function createService(lock: Lock | null) {
  const repository: LockRepository = {
    acquire: vi.fn(),
    refresh: vi.fn(),
    release: vi.fn(),
    forceRelease: vi.fn(),
    getLock: vi.fn().mockResolvedValue(lock),
  };
  const eventBus: LockEventBus = {
    publishLockAcquired: vi.fn(),
    publishLockReleased: vi.fn(),
    publishLockForceReleased: vi.fn(),
  };
  return new LockService(repository, eventBus, { generate: () => 'lock-id' });
}

describe('LockService.requireOwnedLock', () => {
  it('accepts an active lock owned by the actor', async () => {
    const lock = new Lock(
      'lock-id',
      'entity',
      RESOURCE_ID,
      ACTOR_ID,
      new Date(),
      new Date(Date.now() + 60_000)
    );
    await expect(createService(lock).requireOwnedLock('entity', RESOURCE_ID, ACTOR_ID)).resolves.toBeUndefined();
  });

  it('rejects a missing lock', async () => {
    await expect(createService(null).requireOwnedLock('entity', RESOURCE_ID, ACTOR_ID))
      .rejects.toThrow(LockNotFoundError);
  });

  it('rejects an expired lock', async () => {
    const lock = new Lock(
      'lock-id',
      'entity',
      RESOURCE_ID,
      ACTOR_ID,
      new Date(Date.now() - 120_000),
      new Date(Date.now() - 60_000)
    );
    await expect(createService(lock).requireOwnedLock('entity', RESOURCE_ID, ACTOR_ID))
      .rejects.toThrow(LockExpiredError);
  });

  it('rejects a lock owned by another actor', async () => {
    const lock = new Lock(
      'lock-id',
      'entity',
      RESOURCE_ID,
      '00000000-0000-0000-0000-000000000099',
      new Date(),
      new Date(Date.now() + 60_000)
    );
    await expect(createService(lock).requireOwnedLock('entity', RESOURCE_ID, ACTOR_ID))
      .rejects.toThrow(LockConflictError);
  });
});
