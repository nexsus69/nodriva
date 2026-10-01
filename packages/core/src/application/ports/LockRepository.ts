import type { Lock } from '../../domain/models/Lock.js';
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
   * Releases a lock held by a specific user. When lockId is supplied, a
   * release for an older lock generation is a no-op if a newer lock owned by
   * the same session is already present.
   * If the lock is held by someone else, it throws LockForbiddenError.
   */
  release(resource: ResourceReference, userId: string, sessionId: string, lockId?: string): Promise<boolean>;

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
