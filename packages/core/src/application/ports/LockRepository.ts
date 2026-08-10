import { Lock } from '../../domain/models/Lock.js';
import type { ResourceReference } from '../../domain/models/ResourceReference.js';

export interface LockRepository {
  /**
   * Acquires a lock for a specific resource.
   * If the lock is already held by another user and not expired, it throws LockConflictError.
   * If the lock is expired, it atomically steals it.
   */
  acquire(lock: Lock): Promise<void>;

  /**
   * Refreshes an existing lock, extending its expiration time.
   * If the lock does not exist or is held by someone else, throws LockNotFoundError / LockConflictError.
   */
  refresh(resource: ResourceReference, userId: string, sessionId: string, newExpiresAt: Date): Promise<void>;

  /**
   * Releases a lock held by a specific user.
   * If the lock is held by someone else, it throws LockForbiddenError.
   */
  release(resource: ResourceReference, userId: string, sessionId: string): Promise<void>;

  /** Releases every lock owned by one authenticated session. */
  releaseAllForSession(sessionId: string): Promise<Lock[]>;

  /**
   * Force releases a lock regardless of who owns it. Used by admins.
   */
  forceRelease(resource: ResourceReference): Promise<void>;

  /**
   * Retrieves the current lock for a resource, if any.
   */
  getLock(resource: ResourceReference): Promise<Lock | null>;
}
