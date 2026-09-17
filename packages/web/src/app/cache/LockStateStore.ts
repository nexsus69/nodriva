/** Stores one local lock snapshot per resource and coordinates its hydration. */
import type { ResourceKind } from '@dashboard/core';

export interface CachedLockState {
  locked: boolean;
  byUserId?: string;
  bySessionId?: string;
  expiresAt?: string;
}

export interface LockStateStoreOptions {
  load: (resourceType: ResourceKind, resourceId: string) => Promise<CachedLockState>;
  onChanged?: () => void;
  now?: () => number;
}

const EMPTY_LOCK_STATE: CachedLockState = { locked: false };

/**
 * Keeps lock snapshots local to the browser without deciding how they are
 * fetched or how realtime events are transported.
 */
export class LockStateStore {
  private readonly states = new Map<string, CachedLockState>();
  private readonly subscribers = new Map<string, Set<(state: CachedLockState) => void>>();
  private readonly hydratedKeys = new Set<string>();
  private readonly pendingHydrations = new Map<string, Promise<void>>();
  private readonly now: () => number;

  public constructor(private readonly options: LockStateStoreOptions) {
    this.now = options.now ?? Date.now;
  }

  public get(resourceType: ResourceKind, resourceId: string): CachedLockState {
    const state = this.states.get(this.key(resourceType, resourceId));
    if (state?.locked && state.expiresAt && Date.parse(state.expiresAt) <= this.now()) {
      return EMPTY_LOCK_STATE;
    }
    return state ?? EMPTY_LOCK_STATE;
  }

  public hydrate(resourceType: ResourceKind, resourceId: string): Promise<void> {
    const key = this.key(resourceType, resourceId);
    if (this.hydratedKeys.has(key)) return Promise.resolve();

    const pending = this.pendingHydrations.get(key);
    if (pending) return pending;

    const request = this.options.load(resourceType, resourceId)
      .then((state) => {
        const current = this.get(resourceType, resourceId);
        // A local mutation or realtime acquisition is newer than a delayed
        // unlocked snapshot read before that change.
        if (!current.locked || state.locked) this.set(resourceType, resourceId, state);
        this.hydratedKeys.add(key);
      })
      .catch(() => {
        // Rendering remains available. A later authoritative snapshot can retry.
      })
      .finally(() => this.pendingHydrations.delete(key));

    this.pendingHydrations.set(key, request);
    return request;
  }

  public subscribe(
    resourceType: ResourceKind,
    resourceId: string,
    subscriber: (state: CachedLockState) => void,
  ): () => void {
    const key = this.key(resourceType, resourceId);
    const subscribers = this.subscribers.get(key) ?? new Set();
    subscribers.add(subscriber);
    this.subscribers.set(key, subscribers);
    return () => {
      const current = this.subscribers.get(key);
      if (!current) return;
      current.delete(subscriber);
      if (current.size === 0) this.subscribers.delete(key);
    };
  }

  public set(resourceType: ResourceKind, resourceId: string, state: CachedLockState): void {
    const key = this.key(resourceType, resourceId);
    const normalized = state.locked ? state : EMPTY_LOCK_STATE;
    this.states.set(key, normalized);
    this.hydratedKeys.add(key);
    this.subscribers.get(key)?.forEach((subscriber) => subscriber(normalized));
    this.options.onChanged?.();
  }

  /** Clears data-derived state while keeping mounted UI subscriptions alive. */
  public clearReadModel(): void {
    this.states.clear();
    this.hydratedKeys.clear();
    this.pendingHydrations.clear();
  }

  /** Removes both data and subscriptions when the authenticated browser session ends. */
  public purge(): void {
    this.clearReadModel();
    this.subscribers.clear();
  }

  private key(resourceType: ResourceKind, resourceId: string): string {
    return `${resourceType}:${resourceId}`;
  }
}
