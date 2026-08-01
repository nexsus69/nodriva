import { Lock } from '../../domain/models/Lock.js';
import { LockRepository } from '../ports/LockRepository.js';
import { LockEventBus } from '../ports/LockEventBus.js';
import { IdGeneratorPort } from '../ports/IdGeneratorPort.js';
import { LockConflictError } from '../../domain/errors/ApplicationErrors.js';
import { LockExpiredError, LockNotFoundError } from '../../domain/errors/ApplicationErrors.js';

export class LockService {
  constructor(
    private readonly lockRepository: LockRepository,
    private readonly lockEventBus: LockEventBus,
    private readonly idGenerator: IdGeneratorPort,
    private readonly defaultTtlSeconds: number = 120
  ) {}

  /**
   * Acquires a lock on a resource for a user.
   */
  async lock(resourceType: string, resourceId: string, userId: string, ttlSeconds: number = this.defaultTtlSeconds): Promise<Lock> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const lock = new Lock(
      this.idGenerator.generate(),
      resourceType,
      resourceId,
      userId,
      new Date(),
      expiresAt
    );

    await this.lockRepository.acquire(lock);

    // Publish event asynchronously without failing the operation
    this.publishGracefully(() => this.lockEventBus.publishLockAcquired(lock));

    return lock;
  }

  /**
   * Refreshes an existing lock.
   */
  async refresh(resourceType: string, resourceId: string, userId: string, extendSeconds: number = this.defaultTtlSeconds): Promise<Lock> {
    const newExpiresAt = new Date(Date.now() + extendSeconds * 1000);
    await this.lockRepository.refresh(resourceType, resourceId, userId, newExpiresAt);

    const lock = await this.lockRepository.getLock(resourceType, resourceId);
    if (lock) {
      this.publishGracefully(() => this.lockEventBus.publishLockAcquired(lock));
      return lock;
    }
    throw new LockConflictError(resourceType, resourceId); // Fallback se sparito nel mentre
  }

  /**
   * Releases a lock held by a specific user.
   */
  async unlock(resourceType: string, resourceId: string, userId: string): Promise<void> {
    await this.lockRepository.release(resourceType, resourceId, userId);
    this.publishGracefully(() => this.lockEventBus.publishLockReleased(resourceType, resourceId, userId));
  }

  /**
   * Force releases a lock. Typically used by admins.
   */
  async forceUnlock(resourceType: string, resourceId: string): Promise<void> {
    await this.lockRepository.forceRelease(resourceType, resourceId);
    this.publishGracefully(() => this.lockEventBus.publishLockForceReleased(resourceType, resourceId));
  }

  /**
   * Checks if a resource is currently locked by ANYONE.
   * If it's expired, it's considered unlocked.
   */
  async isLocked(resourceType: string, resourceId: string): Promise<{ locked: boolean; byUserId?: string }> {
    const lock = await this.lockRepository.getLock(resourceType, resourceId);
    if (lock && !lock.isExpired()) {
      return { locked: true, byUserId: lock.userId };
    }
    return { locked: false };
  }

  /**
   * Used by other Domain Services to assert that the current user holds the lock if needed.
   * If there is an active lock belonging to someone else, throws LockConflictError.
   */
  async requireLockIfNeeded(resourceType: string, resourceId: string, actorUserId: string): Promise<void> {
    const lock = await this.lockRepository.getLock(resourceType, resourceId);
    
    // Se non c'è lock o è scaduto, è modificabile (chiunque può rubarlo acquisendolo)
    if (!lock || lock.isExpired()) {
      return;
    }

    // Se c'è un lock attivo, DEVE essere dell'attore che sta tentando di modificare
    if (lock.userId !== actorUserId) {
      throw new LockConflictError(resourceType, resourceId);
    }
  }

  /**
   * Requires an active lock owned by the actor. Used by edit-mode mutations.
   */
  async requireOwnedLock(resourceType: string, resourceId: string, actorUserId: string): Promise<void> {
    const lock = await this.lockRepository.getLock(resourceType, resourceId);
    if (!lock) {
      throw new LockNotFoundError(resourceType, resourceId);
    }
    if (lock.isExpired()) {
      throw new LockExpiredError(resourceType, resourceId);
    }
    if (lock.userId !== actorUserId) {
      throw new LockConflictError(resourceType, resourceId);
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
}
