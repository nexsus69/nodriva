import { Lock } from '../../domain/models/Lock.js';

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
  refresh(resourceType: string, resourceId: string, userId: string, newExpiresAt: Date): Promise<void>;

  /**
   * Releases a lock held by a specific user.
   * If the lock is held by someone else, it throws LockForbiddenError.
   */
  release(resourceType: string, resourceId: string, userId: string): Promise<void>;

  /**
   * Force releases a lock regardless of who owns it. Used by admins.
   */
  forceRelease(resourceType: string, resourceId: string): Promise<void>;

  /**
   * Retrieves the current lock for a resource, if any.
   */
  getLock(resourceType: string, resourceId: string): Promise<Lock | null>;
}
