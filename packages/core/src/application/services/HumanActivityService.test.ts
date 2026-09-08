/** Verifies session and lock renewal driven by genuine human activity. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Lock } from '../../domain/models/Lock.js';
import type { LockEventBus } from '../ports/LockEventBus.js';
import type { LockRepository } from '../ports/LockRepository.js';
import type { SessionRepositoryPort } from '../ports/SessionRepositoryPort.js';
import type { TransactionPort } from '../ports/TransactionPort.js';
import { HumanActivityService } from './HumanActivityService.js';
import { LockService } from './LockService.js';

const NOW = new Date('2026-08-06T18:00:00.000Z');
const SESSION_ID = '00000000-0000-7000-8000-000000000001';
const USER_ID = '00000000-0000-7000-8000-000000000002';
const RESOURCE_ID = '00000000-0000-7000-8000-000000000003';

function createContext() {
  let lockExpiry = new Date(NOW.getTime() + 60_000);
  const sessions: SessionRepositoryPort = {
    createSession: vi.fn(),
    getSessionUserId: vi.fn(),
    getActiveSessionExpiry: vi.fn().mockResolvedValue(lockExpiry),
    touchSession: vi.fn().mockResolvedValue(true),
    deleteSession: vi.fn(),
    deleteSessionsForUser: vi.fn(),
  };
  const lockRepository: LockRepository = {
    acquire: vi.fn(),
    refresh: vi.fn().mockImplementation(async (_resource, _user, _session, expiresAt: Date) => {
      lockExpiry = expiresAt;
    }),
    release: vi.fn(),
    forceRelease: vi.fn(),
    getLock: vi.fn().mockImplementation(async () => new Lock(
      'lock-id',
      { resourceType: 'node', resourceId: RESOURCE_ID },
      USER_ID,
      SESSION_ID,
      NOW,
      lockExpiry,
    )),
    releaseAllForSession: vi.fn().mockResolvedValue([]),
  };
  const events: LockEventBus = {
    publishLockAcquired: vi.fn().mockResolvedValue(undefined),
    publishLockReleased: vi.fn().mockResolvedValue(undefined),
    publishLockForceReleased: vi.fn().mockResolvedValue(undefined),
  };
  const locks = new LockService(lockRepository, events, { generate: () => 'lock-id' }, 300);
  const transactions: TransactionPort = {
    runInTransaction: vi.fn(async (work) => await work()),
    runInAuthorizationMutation: vi.fn(async (work) => await work()),
  };
  const service = new HumanActivityService(sessions, locks, transactions, 300, 100);
  return { service, sessions, lockRepository };
}

describe('HumanActivityService', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('checks status without touching the session', async () => {
    const { service, sessions } = createContext();
    await expect(service.getStatus(SESSION_ID, USER_ID)).resolves.toEqual({
      sessionExpiresAt: new Date(NOW.getTime() + 60_000),
      timing: {
        sessionIdleTimeoutSeconds: 300,
        sessionUpdateAgeSeconds: 50,
        lockTtlSeconds: 100,
        syncPollingIntervalSeconds: 50,
      },
    });
    expect(sessions.touchSession).not.toHaveBeenCalled();
  });

  it('renews session and owned locks from the same activity with distinct deadlines', async () => {
    const { service, sessions, lockRepository } = createContext();
    const result = await service.recordActivity(SESSION_ID, USER_ID, [{
      resourceType: 'node',
      resourceId: RESOURCE_ID,
    }]);
    const expectedSessionExpiry = new Date(NOW.getTime() + 300_000);
    const expectedLockExpiry = new Date(NOW.getTime() + 100_000);

    expect(sessions.touchSession).toHaveBeenCalledWith(SESSION_ID, USER_ID, expectedSessionExpiry);
    expect(lockRepository.refresh).toHaveBeenCalledWith({ resourceType: 'node', resourceId: RESOURCE_ID }, USER_ID, SESSION_ID, expectedLockExpiry);
    expect(result.sessionExpiresAt).toEqual(expectedSessionExpiry);
    expect(result.renewedLocks[0]?.expiresAt).toEqual(expectedLockExpiry);
  });

  it('does not renew locks when the session is already expired', async () => {
    const { service, sessions, lockRepository } = createContext();
    vi.mocked(sessions.touchSession).mockResolvedValueOnce(false);

    await expect(service.recordActivity(SESSION_ID, USER_ID, [{
      resourceType: 'node',
      resourceId: RESOURCE_ID,
    }])).rejects.toMatchObject({ code: 'AUTH_UNAUTHORIZED' });
    expect(lockRepository.refresh).not.toHaveBeenCalled();
  });
});
