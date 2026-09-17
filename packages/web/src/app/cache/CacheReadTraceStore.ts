/** Records a bounded, non-authoritative history of cache read and invalidation decisions. */
export type CacheReadTraceEvent = {
  id: string;
  occurredAt: string;
  kind: "read" | "invalidation";
  key: string;
  source?: "cache" | "backend";
  reason: string;
};

/** Isolates cache observability from cache storage and freshness policy. */
export class CacheReadTraceStore {
  private events: CacheReadTraceEvent[] = [];
  private readonly subscribers = new Set<(events: readonly CacheReadTraceEvent[]) => void>();

  public getEvents(): readonly CacheReadTraceEvent[] { return this.events; }
  public subscribe(subscriber: (events: readonly CacheReadTraceEvent[]) => void): () => void {
    this.subscribers.add(subscriber);
    subscriber(this.events);
    return () => this.subscribers.delete(subscriber);
  }
  public record(event: Omit<CacheReadTraceEvent, "id" | "occurredAt">): void {
    this.events = [...this.events, { ...event, id: crypto.randomUUID(), occurredAt: new Date().toISOString() }].slice(-200);
    this.subscribers.forEach((subscriber) => subscriber(this.events));
  }
  public clear(): void { this.events = []; this.subscribers.forEach((subscriber) => subscriber(this.events)); }
}
