import type { Lock } from '../../domain/models/Lock.js';
import type { ResourceReference } from '../../domain/models/ResourceReference.js';

export interface LockEventScope {
  /** Node that owns the lockable resource: the node itself or an entity parent. */
  scopeNodeId?: string;
}

export interface LockEventBus {
  /**
   * Dispatched when a lock is successfully acquired or refreshed.
   */
  publishLockAcquired(lock: Lock, scope?: LockEventScope): Promise<void>;

  /**
   * Dispatched when a lock is released by its owner.
   */
  publishLockReleased(resource: ResourceReference, userId: string, sessionId: string, scope?: LockEventScope): Promise<void>;

  /**
   * Dispatched when an admin force-releases a lock.
   */
  publishLockForceReleased(resource: ResourceReference, scope?: LockEventScope): Promise<void>;
}
