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
import { AuditPort } from '../ports/AuditPort.js';

const RESOURCE_ID = '00000000-0000-0000-0000-000000000001';
const ACTOR_ID = '00000000-0000-0000-0000-000000000002';
const ACTOR_SESSION_ID = '00000000-0000-7000-8000-000000000003';

function createService(lock: Lock | null) {
  const repository: LockRepository = {
    acquire: vi.fn(),
    refresh: vi.fn(),
    release: vi.fn(),
    forceRelease: vi.fn(),
    getLock: vi.fn().mockResolvedValue(lock),
    releaseAllForSession: vi.fn().mockResolvedValue([]),
  };
  const eventBus: LockEventBus = {
    publishLockAcquired: vi.fn().mockResolvedValue(undefined),
    publishLockReleased: vi.fn().mockResolvedValue(undefined),
    publishLockForceReleased: vi.fn().mockResolvedValue(undefined),
  };
  const auditPort: AuditPort = { record: vi.fn().mockResolvedValue(undefined) };
  return { service: new LockService(repository, eventBus, { generate: () => 'lock-id' }, 120, auditPort), repository, auditPort };
}

describe('LockService.requireOwnedLock', () => {
  it('accepts an active lock owned by the actor', async () => {
    const lock = new Lock(
      'lock-id',
      { resourceType: 'entity', resourceId: RESOURCE_ID },
      ACTOR_ID,
      ACTOR_SESSION_ID,
      new Date(),
      new Date(Date.now() + 60_000)
    );
    await expect(createService(lock).service.requireOwnedLock({ resourceType: 'entity', resourceId: RESOURCE_ID }, ACTOR_ID, ACTOR_SESSION_ID)).resolves.toBeUndefined();
  });

  it('rejects a missing lock', async () => {
    await expect(createService(null).service.requireOwnedLock({ resourceType: 'entity', resourceId: RESOURCE_ID }, ACTOR_ID, ACTOR_SESSION_ID))
      .rejects.toThrow(LockNotFoundError);
  });

  it('rejects an expired lock', async () => {
    const lock = new Lock(
      'lock-id',
      { resourceType: 'entity', resourceId: RESOURCE_ID },
      ACTOR_ID,
      ACTOR_SESSION_ID,
      new Date(Date.now() - 120_000),
      new Date(Date.now() - 60_000)
    );
    await expect(createService(lock).service.requireOwnedLock({ resourceType: 'entity', resourceId: RESOURCE_ID }, ACTOR_ID, ACTOR_SESSION_ID))
      .rejects.toThrow(LockExpiredError);
  });

  it('rejects a lock owned by another actor', async () => {
    const lock = new Lock(
      'lock-id',
      { resourceType: 'entity', resourceId: RESOURCE_ID },
      '00000000-0000-0000-0000-000000000099',
      ACTOR_SESSION_ID,
      new Date(),
      new Date(Date.now() + 60_000)
    );
    await expect(createService(lock).service.requireOwnedLock({ resourceType: 'entity', resourceId: RESOURCE_ID }, ACTOR_ID, ACTOR_SESSION_ID))
      .rejects.toThrow(LockConflictError);
  });

  it('rejects a lock owned by another session of the same user', async () => {
    const lock = new Lock(
      'lock-id',
      { resourceType: 'entity', resourceId: RESOURCE_ID },
      ACTOR_ID,
      '00000000-0000-7000-8000-000000000099',
      new Date(),
      new Date(Date.now() + 60_000)
    );
    await expect(createService(lock).service.requireOwnedLock({ resourceType: 'entity', resourceId: RESOURCE_ID }, ACTOR_ID, ACTOR_SESSION_ID))
      .rejects.toThrow(LockConflictError);
  });
});

describe('LockService audit events', () => {
  it('audits successful acquisition and release without auditing refreshes', async () => {
    const context = createService(null);
    const lock = await context.service.lock({ resourceType: 'node', resourceId: RESOURCE_ID }, ACTOR_ID, ACTOR_SESSION_ID, 120, { scopeNodeId: RESOURCE_ID });
    vi.mocked(context.repository.getLock).mockResolvedValue(lock);
    await context.service.refreshUntil({ resourceType: 'node', resourceId: RESOURCE_ID }, ACTOR_ID, ACTOR_SESSION_ID, new Date(Date.now() + 120_000), { scopeNodeId: RESOURCE_ID });
    await context.service.unlock({ resourceType: 'node', resourceId: RESOURCE_ID }, ACTOR_ID, ACTOR_SESSION_ID, { scopeNodeId: RESOURCE_ID });

    expect(context.auditPort.record).toHaveBeenCalledWith(ACTOR_ID, 'lock.acquire', 'node', RESOURCE_ID, RESOURCE_ID, null, expect.objectContaining({ lockId: lock.id }));
    expect(context.auditPort.record).toHaveBeenCalledWith(ACTOR_ID, 'lock.release', 'node', RESOURCE_ID, RESOURCE_ID, { sessionId: ACTOR_SESSION_ID }, null);
    expect(context.auditPort.record).toHaveBeenCalledTimes(2);
  });

  it('audits a rejected acquisition conflict and preserves the error', async () => {
    const context = createService(null);
    vi.mocked(context.repository.acquire).mockRejectedValue(new LockConflictError('entity', RESOURCE_ID));

    await expect(context.service.lock({ resourceType: 'entity', resourceId: RESOURCE_ID }, ACTOR_ID, ACTOR_SESSION_ID)).rejects.toThrow(LockConflictError);
    expect(context.auditPort.record).toHaveBeenCalledWith(ACTOR_ID, 'lock.conflict', 'entity', RESOURCE_ID, null, null, {
      attemptedSessionId: ACTOR_SESSION_ID,
      reason: 'active_lock',
    });
  });

  it('audits administrative force release', async () => {
    const context = createService(null);
    await context.service.forceUnlock({ resourceType: 'node', resourceId: RESOURCE_ID }, { scopeNodeId: RESOURCE_ID });

    expect(context.auditPort.record).toHaveBeenCalledWith(null, 'lock.force_release', 'node', RESOURCE_ID, RESOURCE_ID, null, { reason: 'administrative_release' });
  });
});
