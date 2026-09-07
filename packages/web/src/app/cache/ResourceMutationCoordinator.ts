import type { RealtimeDataChangedEvent } from '@dashboard/core';

export type ResourceMutationOperation<T> = (mutationId: string) => Promise<T>;
export type ResourceMutationCommit<T> = (result: T) => void;

/**
 * Correlates a local mutation with its durable realtime event.
 *
 * The local mutation response is authoritative. A realtime event carrying the
 * same mutation id is only a delivery confirmation and must not be interpreted
 * as an external edit. The coordinator is deliberately resource-agnostic so
 * node and entity flows share one protocol.
 */
export class ResourceMutationCoordinator {
  private originSessionId: string | null = null;
  private readonly pending = new Set<string>();
  private readonly pendingResources = new Set<string>();
  private readonly latestLocalVersions = new Map<string, number>();
  private readonly completed: string[] = [];
  private readonly completedSet = new Set<string>();

  public async run<T>(resourceKey: string, operation: ResourceMutationOperation<T>, commit: ResourceMutationCommit<T>): Promise<T> {
    const mutationId = createMutationId();
    this.pending.add(mutationId);
    this.pendingResources.add(resourceKey);
    try {
      const result = await operation(mutationId);
      commit(result);
      const rowVersion = extractRowVersion(result);
      if (rowVersion !== undefined) this.latestLocalVersions.set(resourceKey, rowVersion);
      this.rememberCompleted(mutationId);
      return result;
    } finally {
      this.pending.delete(mutationId);
      this.pendingResources.delete(resourceKey);
    }
  }

  public isPending(resourceKey: string): boolean {
    return this.pendingResources.has(resourceKey);
  }

  public isLocalVersion(resourceKey: string, rowVersion: number | undefined): boolean {
    return rowVersion !== undefined && this.latestLocalVersions.get(resourceKey) === rowVersion;
  }

  public isLocalEvent(event: Pick<RealtimeDataChangedEvent, 'mutationId' | 'originSessionId'>): boolean {
    const correlatedMutation = typeof event.mutationId === 'string'
      && (this.pending.has(event.mutationId) || this.completedSet.has(event.mutationId));
    const sameSession = 'originSessionId' in event
      && typeof event.originSessionId === 'string'
      && event.originSessionId === this.originSessionId;
    return correlatedMutation || sameSession;
  }

  public setOriginSessionId(sessionId: string | null | undefined): void {
    this.originSessionId = sessionId ?? null;
  }

  private rememberCompleted(mutationId: string): void {
    if (this.completedSet.has(mutationId)) return;
    this.completed.push(mutationId);
    this.completedSet.add(mutationId);
    if (this.completed.length > 1000) {
      const expired = this.completed.shift();
      if (expired) this.completedSet.delete(expired);
    }
  }
}

function createMutationId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function extractRowVersion(value: unknown): number | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const rowVersion = Reflect.get(value, 'rowVersion');
  return typeof rowVersion === 'number' ? rowVersion : undefined;
}
