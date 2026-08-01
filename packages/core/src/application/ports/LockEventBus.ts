import { Lock } from '../../domain/models/Lock.js';

export interface LockEventBus {
  /**
   * Dispatched when a lock is successfully acquired or refreshed.
   */
  publishLockAcquired(lock: Lock): Promise<void>;

  /**
   * Dispatched when a lock is released by its owner.
   */
  publishLockReleased(resourceType: string, resourceId: string, userId: string): Promise<void>;

  /**
   * Dispatched when an admin force-releases a lock.
   */
  publishLockForceReleased(resourceType: string, resourceId: string): Promise<void>;
}
