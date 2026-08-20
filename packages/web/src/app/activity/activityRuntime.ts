import type { ActivityLockRef } from './activityTypes';

export interface HeartbeatToken {
  readonly generation: number;
  readonly requestId: number;
}

/** Owns heartbeat throttling and prevents stale requests from mutating a new session. */
export class ActivityHeartbeatGate {
  private generation = 0;
  private requestSequence = 0;
  private activeToken?: HeartbeatToken;
  private lastHeartbeatAt?: number;

  start(now: number, throttleMs: number): HeartbeatToken | null {
    if (this.activeToken) return null;
    if (this.lastHeartbeatAt !== undefined && now < this.lastHeartbeatAt + throttleMs) return null;

    const token = { generation: this.generation, requestId: ++this.requestSequence };
    this.lastHeartbeatAt = now;
    this.activeToken = token;
    return token;
  }

  isCurrent(token: HeartbeatToken): boolean {
    return token.generation === this.generation && this.activeToken === token;
  }

  captureGeneration(): number {
    return this.generation;
  }

  isGenerationCurrent(generation: number): boolean {
    return generation === this.generation;
  }

  finish(token: HeartbeatToken): void {
    if (this.activeToken === token) this.activeToken = undefined;
  }

  reset(): void {
    this.generation += 1;
    this.activeToken = undefined;
    this.lastHeartbeatAt = undefined;
  }
}

export class ActiveLockRegistry {
  private readonly locks = new Map<string, ActivityLockRef>();

  register(lock: ActivityLockRef): () => boolean {
    const key = lockKey(lock);
    this.locks.set(key, lock);
    return () => {
      if (this.locks.get(key) !== lock) return false;
      return this.locks.delete(key);
    };
  }

  values(): ActivityLockRef[] {
    return [...this.locks.values()];
  }

  clear(): void {
    this.locks.clear();
  }
}

export function lockKey(lock: ActivityLockRef): string {
  return `${lock.resourceType}:${lock.resourceId}`;
}
