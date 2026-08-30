import { Lock } from '../../domain/models/Lock.js';
import type { LockRepository } from '../ports/LockRepository.js';
import type { LockEventBus} from '../ports/LockEventBus.js';
import { type LockEventScope } from '../ports/LockEventBus.js';
import type { IdGeneratorPort } from '../ports/IdGeneratorPort.js';
import { LockConflictError } from '../../domain/errors/ApplicationErrors.js';
import { LockExpiredError, LockNotFoundError } from '../../domain/errors/ApplicationErrors.js';
import type { SessionTimingPolicyPort } from '../ports/SessionTimingPolicyPort.js';
import type { AuditPort } from '../ports/AuditPort.js';
import type { ResourceReference } from '../../domain/models/ResourceReference.js';
import type { TransactionPort } from '../ports/TransactionPort.js';

export class LockService {
  constructor(
    private readonly lockRepository: LockRepository,
    private readonly lockEventBus: LockEventBus,
    private readonly idGenerator: IdGeneratorPort,
    private readonly timing: SessionTimingPolicyPort | number,
    private readonly auditPort?: AuditPort,
    private readonly transactions?: TransactionPort,
  ) {}

  /**
   * Acquires a lock on a resource for a user.
   */
  async lock(resource: ResourceReference, userId: string, sessionId: string, ttlSeconds?: number, scope?: LockEventScope): Promise<Lock> {
    const effectiveTtlSeconds = ttlSeconds ?? await this.getLockTtlSeconds();
    const expiresAt = new Date(Date.now() + effectiveTtlSeconds * 1000);
    const lock = new Lock(
      this.idGenerator.generate(),
      resource,
      userId,
      sessionId,
      new Date(),
      expiresAt
    );

    try {
      await this.inTransaction(async () => {
        await this.lockRepository.acquire(lock);
        await this.recordAuditStrict(userId, 'lock.acquire', resource.resourceType, resource.resourceId, scope?.scopeNodeId ?? null, null, {
          lockId: lock.id,
          sessionId: lock.sessionId,
          acquiredAt: lock.acquiredAt.toISOString(),
          expiresAt: lock.expiresAt.toISOString(),
        });
      });
    } catch (error) {
      if (error instanceof LockConflictError) {
        await this.recordAuditGracefully(userId, 'lock.conflict', resource.resourceType, resource.resourceId, scope?.scopeNodeId ?? null, null, {
          attemptedSessionId: sessionId,
          reason: 'active_lock',
        });
      }
      throw error;
    }

    // Publish event asynchronously without failing the operation
    this.publishGracefully(() => this.lockEventBus.publishLockAcquired(lock, scope));

    return lock;
  }

  /**
   * Refreshes an existing lock.
   */
  async refresh(resource: ResourceReference, userId: string, sessionId: string, extendSeconds?: number, scope?: LockEventScope): Promise<Lock> {
    const effectiveExtendSeconds = extendSeconds ?? await this.getLockTtlSeconds();
    const newExpiresAt = new Date(Date.now() + effectiveExtendSeconds * 1000);
    return await this.refreshUntil(resource, userId, sessionId, newExpiresAt, scope);
  }

  private async getLockTtlSeconds(): Promise<number> {
    if (typeof this.timing === 'number') return this.timing;
    return (await this.timing.getSessionTimingPolicy()).lockTtlSeconds;
  }

  /** Refreshes an owned lock to an externally coordinated activity deadline. */
  async refreshUntil(resource: ResourceReference, userId: string, sessionId: string, newExpiresAt: Date, scope?: LockEventScope): Promise<Lock> {
    await this.lockRepository.refresh(resource, userId, sessionId, newExpiresAt);

    const lock = await this.lockRepository.getLock(resource);
    if (lock) {
      this.publishGracefully(() => this.lockEventBus.publishLockAcquired(lock, scope));
      return lock;
    }
    throw new LockConflictError(resource.resourceType, resource.resourceId); // Fallback se sparito nel mentre
  }

  /**
   * Releases a lock held by a specific user.
   */
  async unlock(resource: ResourceReference, userId: string, sessionId: string, scope?: LockEventScope): Promise<void> {
    await this.inTransaction(async () => {
      await this.lockRepository.release(resource, userId, sessionId);
      await this.recordAuditStrict(userId, 'lock.release', resource.resourceType, resource.resourceId, scope?.scopeNodeId ?? null, { sessionId }, null);
    });
    this.publishGracefully(() => this.lockEventBus.publishLockReleased(resource, userId, sessionId, scope));
  }

  /** Releases and broadcasts all locks belonging to an intentional logout. */
  async releaseAllForSession(sessionId: string): Promise<void> {
    const released = await this.inTransaction(async () => {
      const locks = await this.lockRepository.releaseAllForSession(sessionId);
      for (const lock of locks) {
        await this.recordAuditStrict(lock.userId, 'lock.release', lock.resourceType, lock.resourceId, null, { sessionId: lock.sessionId, reason: 'session_release' }, null);
      }
      return locks;
    });
    released.forEach((lock) => this.publishGracefully(
      () => this.lockEventBus.publishLockReleased(lock.resource, lock.userId, lock.sessionId),
    ));
  }

  /**
   * Force releases a lock. Typically used by admins.
   */
  async forceUnlock(resource: ResourceReference, scope?: LockEventScope): Promise<void> {
    await this.inTransaction(async () => {
      await this.lockRepository.forceRelease(resource);
      await this.recordAuditStrict(null, 'lock.force_release', resource.resourceType, resource.resourceId, scope?.scopeNodeId ?? null, null, { reason: 'administrative_release' });
    });
    this.publishGracefully(() => this.lockEventBus.publishLockForceReleased(resource, scope));
  }

  /**
   * Checks if a resource is currently locked by ANYONE.
   * If it's expired, it's considered unlocked.
   */
  async isLocked(resource: ResourceReference): Promise<{ locked: boolean; byUserId?: string; bySessionId?: string }> {
    const lock = await this.lockRepository.getLock(resource);
    if (lock && !lock.isExpired()) {
      return { locked: true, byUserId: lock.userId, bySessionId: lock.sessionId };
    }
    return { locked: false };
  }

  /**
   * Used by other Domain Services to assert that the current user holds the lock if needed.
   * If there is an active lock belonging to someone else, throws LockConflictError.
   */
  async requireLockIfNeeded(resource: ResourceReference, actorUserId: string, actorSessionId: string): Promise<void> {
    const lock = await this.lockRepository.getLock(resource);
    
    // Se non c'è lock o è scaduto, è modificabile (chiunque può rubarlo acquisendolo)
    if (!lock || lock.isExpired()) {
      return;
    }

    // Se c'è un lock attivo, DEVE essere dell'attore che sta tentando di modificare
    if (lock.userId !== actorUserId || lock.sessionId !== actorSessionId) {
      throw new LockConflictError(resource.resourceType, resource.resourceId);
    }
  }

  /**
   * Requires an active lock owned by the actor. Used by edit-mode mutations.
   */
  async requireOwnedLock(resource: ResourceReference, actorUserId: string, actorSessionId: string): Promise<void> {
    const lock = await this.lockRepository.getLock(resource);
    if (!lock) {
      throw new LockNotFoundError(resource.resourceType, resource.resourceId);
    }
    if (lock.isExpired()) {
      throw new LockExpiredError(resource.resourceType, resource.resourceId);
    }
    if (lock.userId !== actorUserId || lock.sessionId !== actorSessionId) {
      throw new LockConflictError(resource.resourceType, resource.resourceId);
    }
  }

  /**
   * Helper to ensure event bus failures do not crash the application.
   */
  private publishGracefully(action: () => Promise<void>): void {
    action().catch(err => {
      console.error('[LockEventBus] Error publishing lock event:', err);
    });
  }

  private async inTransaction<T>(work: () => Promise<T>): Promise<T> {
    return this.transactions ? this.transactions.runInTransaction(work) : work();
  }

  private async recordAuditStrict(
    actorUserId: string | null,
    actionKey: string,
    resourceKind: string,
    resourceId: string,
    nodeId: string | null,
    beforePayload: Record<string, unknown> | null,
    afterPayload: Record<string, unknown> | null,
  ): Promise<void> {
    if (!this.auditPort) return;
    await this.auditPort.record(actorUserId, actionKey, resourceKind, resourceId, nodeId, beforePayload, afterPayload);
  }

  private async recordAuditGracefully(
    actorUserId: string | null,
    actionKey: string,
    resourceKind: string,
    resourceId: string,
    nodeId: string | null,
    beforePayload: Record<string, unknown> | null,
    afterPayload: Record<string, unknown> | null,
  ): Promise<void> {
    if (!this.auditPort) return;
    try {
      await this.auditPort.record(actorUserId, actionKey, resourceKind, resourceId, nodeId, beforePayload, afterPayload);
    } catch (error) {
      console.error('[LockService] Failed to record audit event:', error);
    }
  }
}
