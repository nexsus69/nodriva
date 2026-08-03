export class MemoryCache<K, V> {
  private readonly values = new Map<K, { value: V; expiresAt: number }>();
  private readonly inFlight = new Map<K, Promise<V>>();

  constructor(private readonly defaultTtlMs = 30_000) {}

  get(key: K): V | undefined {
    const entry = this.values.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.values.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: K, value: V, ttlMs = this.defaultTtlMs): void {
    this.values.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async getOrLoad(key: K, loader: () => Promise<V>, ttlMs = this.defaultTtlMs): Promise<V> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;

    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const request = loader()
      .then((value) => {
        this.set(key, value, ttlMs);
        return value;
      })
      .finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, request);
    return request;
  }

  invalidate(key: K): void {
    this.values.delete(key);
  }

  clear(): void {
    this.values.clear();
  }
}
