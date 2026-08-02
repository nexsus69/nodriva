export interface CacheEntry<T> {
  data: T | null;
  refCount: number;
  isPartial: boolean;
  error: Error | null;
  subscribers: Set<(data: T | null, error: Error | null) => void>;
}

export type FetcherFn<T> = (id: string) => Promise<T>;

export interface CacheWriteDiagnostic {
  timestamp: number;
  id: string;
  source: string;
  accepted: boolean;
  incomingVersion?: number;
  previousVersion?: number;
  incomingName?: string;
  resultingName?: string;
}

export class DomainCacheClient<T extends { id: string }> {
  private entries = new Map<string, CacheEntry<T>>();
  private lists = new Map<string, CacheEntry<string[]>>();
  private pendingFetches = new Map<string, Promise<T>>();
  private recentWrites: CacheWriteDiagnostic[] = [];

  /**
   * Completely purges the cache for this domain.
   * Useful for security resets (e.g. logout / identity change).
   */
  public purge(): void {
    // Notify all subscribers that data is gone
    for (const entry of this.entries.values()) {
      entry.data = null;
      for (const subscriber of entry.subscribers) {
        subscriber(null, null);
      }
    }
    for (const entry of this.lists.values()) {
      entry.data = null;
      for (const subscriber of entry.subscribers) {
        subscriber(null, null);
      }
    }
    
    this.entries.clear();
    this.lists.clear();
    this.pendingFetches.clear();
    this.onChange?.();
  }

  constructor(
    public readonly domainKey: string,
    private readonly fetcher: FetcherFn<T>,
    private readonly onChange?: () => void
  ) {}

  private ensureEntry(id: string): CacheEntry<T> {
    let entry = this.entries.get(id);
    if (!entry) {
      entry = {
        data: null,
        refCount: 0,
        isPartial: true,
        error: null,
        subscribers: new Set(),
      };
      this.entries.set(id, entry);
    }
    return entry;
  }

  /**
   * Called by UI components when they mount and need a specific ID.
   * Increments the reference count. If count goes from 0 to 1, initializes the entry.
   */
  public retain(id: string): void {
    const entry = this.ensureEntry(id);
    entry.refCount += 1;
  }

  /**
   * Called by UI components when they unmount.
   * Decrements the reference count. If it hits 0, deletes the entry immediately (GC).
   */
  public release(id: string): void {
    const entry = this.entries.get(id);
    if (entry) {
      entry.refCount = Math.max(0, entry.refCount - 1);
      // Removed immediate GC: this.entries.delete(id)
      // Virtual lists unmount rows rapidly. If we delete immediately, 
      // scrolling up/down causes massive refetch loops.
    }
  }

  /**
   * Subscribe to changes for a specific ID. Returns an unsubscribe function.
   */
  public subscribe(id: string, callback: (data: T | null, error: Error | null) => void): () => void {
    const entry = this.ensureEntry(id);
    entry.subscribers.add(callback);
    return () => {
      const currentEntry = this.entries.get(id);
      if (currentEntry) {
        currentEntry.subscribers.delete(callback);
      }
    };
  }

  /**
   * Get data synchronously. If it requires full data but only has partial, returns what it has for now
   * but you should call `fetchIfMissing` right after.
   */
  public get(id: string): T | null {
    const entry = this.entries.get(id);
    return entry ? entry.data : null;
  }

  public getError(id: string): Error | null {
    return this.entries.get(id)?.error ?? null;
  }

  public isFetchPending(id: string): boolean {
    return this.pendingFetches.has(id);
  }

  public getRecentWrites(limit: number = 12): CacheWriteDiagnostic[] {
    return this.recentWrites.slice(-limit);
  }

  /**
   * Checks if we need to fetch the data (either missing, or we need full data but only have partial).
   */
  public needsFetch(id: string, requireComplete: boolean): boolean {
    const entry = this.entries.get(id);
    if (!entry || !entry.data) return true;
    if (requireComplete && entry.isPartial) return true;
    return false;
  }

  /**
   * Fetches data from the provider. Implements Promise Sharing (Deduplication).
   */
  public fetchIfMissing(id: string, requireComplete: boolean = false): Promise<T | null> {
    if (!this.needsFetch(id, requireComplete)) {
      return Promise.resolve(this.get(id));
    }

    // Promise Sharing / Deduplication
    if (this.pendingFetches.has(id)) {
      return this.pendingFetches.get(id)!;
    }

    const fetchPromise = this.fetcher(id)
      .then((fullData) => {
        this.inject(id, fullData, false, 'fetch:detail'); // Inject as complete
        return fullData;
      })
      .catch((err) => {
        const entry = this.entries.get(id);
        if (entry) {
          entry.error = err instanceof Error ? err : new Error(String(err));
          this.notifySubscribers(id);
        }
        throw err;
      })
      .finally(() => {
        this.pendingFetches.delete(id);
      });

    this.pendingFetches.set(id, fetchPromise);
    return fetchPromise;
  }

  /**
   * Injects data into the cache (e.g., from a list fetch or a direct fetch).
   * Supports partial data injection (Normalization).
   */
  public inject(
    id: string,
    data: Partial<T> & { id: string },
    isPartial: boolean = false,
    source: string = 'unknown'
  ): void {
    const entry = this.ensureEntry(id);
    const currentVersion = getRowVersion(entry.data);
    const incomingVersion = getRowVersion(data);

    // A response that started before a successful mutation may arrive later.
    // Never allow it to roll the canonical entity back to an older version.
    if (
      currentVersion !== undefined &&
      incomingVersion !== undefined &&
      incomingVersion < currentVersion
    ) {
      this.recordWrite({
        timestamp: Date.now(),
        id,
        source,
        accepted: false,
        incomingVersion,
        previousVersion: currentVersion,
        incomingName: getName(data),
        resultingName: getName(entry.data),
      });
      return;
    }

    // An unversioned partial projection may enrich missing fields but cannot
    // overwrite fields of an already-versioned canonical value.
    entry.data =
      entry.data && isPartial && currentVersion !== undefined && incomingVersion === undefined
        ? ({ ...data, ...entry.data } as T)
        : ({ ...entry.data, ...data } as T);
    entry.error = null; // clear errors on successful inject
    // Completeness is monotonic: a partial projection cannot downgrade an
    // entry that was already hydrated by a detail or mutation response.
    if (!isPartial) {
      entry.isPartial = false;
    }

    this.recordWrite({
      timestamp: Date.now(),
      id,
      source,
      accepted: true,
      incomingVersion,
      previousVersion: currentVersion,
      incomingName: getName(data),
      resultingName: getName(entry.data),
    });
    
    this.notifySubscribers(id);
  }

  private recordWrite(diagnostic: CacheWriteDiagnostic): void {
    this.recentWrites.push(diagnostic);
    if (this.recentWrites.length > 40) {
      this.recentWrites.splice(0, this.recentWrites.length - 40);
    }
  }

  /**
   * Mutates data optimistically or after a server update, notifying all subscribers.
   */
  public mutate(id: string, partialData: Partial<T>): void {
    const entry = this.entries.get(id);
    if (entry && entry.data) {
      entry.data = { ...entry.data, ...partialData } as T;
      this.notifySubscribers(id);
    }
  }

  /**
   * Completely removes an entity from the cache (e.g. after deletion), notifying subscribers with null.
   */
  public remove(id: string): void {
    const entry = this.entries.get(id);
    if (entry) {
      this.entries.delete(id);
      entry.subscribers.forEach((cb) => cb(null, null));
      this.onChange?.();
    }
  }

  /** Marks a cached projection stale while preserving the current value for the UI. */
  public invalidate(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.isPartial = true;
    this.notifySubscribers(id);
  }

  private notifySubscribers(id: string) {
    const entry = this.entries.get(id);
    if (entry) {
      entry.subscribers.forEach((cb) => cb(entry.data, entry.error));
    }
    this.onChange?.();
  }
}

function getRowVersion(value: unknown): number | undefined {
  if (!value || typeof value !== 'object' || !('rowVersion' in value)) {
    return undefined;
  }
  const rowVersion = (value as { rowVersion?: unknown }).rowVersion;
  return typeof rowVersion === 'number' && Number.isFinite(rowVersion)
    ? rowVersion
    : undefined;
}

function getName(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || !('name' in value)) return undefined;
  const name = (value as { name?: unknown }).name;
  return typeof name === 'string' ? name : undefined;
}
