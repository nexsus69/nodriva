/** Identifies the minimum shape required for every canonical cached record. */
export interface CacheRecord {
  id: string;
}

/** Describes whether a cached record contains summary or complete data. */
export type RecordCompleteness = 'summary' | 'full';

/** Describes whether a record can be safely consumed by a view. */
export type RecordSatisfaction = 'missing' | 'incomplete' | 'stale' | 'satisfied';

/** Controls the completeness level written into the canonical record store. */
export interface CacheRecordWriteOptions {
  completeness?: RecordCompleteness;
}

/** Immutable list projection stored by the cache without duplicating records. */
export interface CacheQuerySnapshot {
  readonly key: string;
  readonly recordNamespace?: string;
  readonly ids: readonly string[];
  readonly dependencies: readonly string[];
  readonly generation: number;
  readonly fetchedAt: number;
}

/** Result returned by a query loader before the cache adds generation metadata. */
export interface CacheQueryLoaderResult {
  ids: readonly string[];
  recordNamespace?: string;
  dependencies?: readonly string[];
}

/** Optional policy used when loading or validating a query projection. */
export interface CacheQueryOptions {
  recordNamespace?: string;
  dependencies?: readonly string[];
  ttlMs?: number;
}

/** Describes the cache effects that follow a successful domain mutation. */
export interface CacheMutationOptions<TResult> {
  commit?: (result: TResult, kernel: CacheKernel) => void;
  invalidateTokens?: readonly string[];
  invalidateQueries?: readonly string[];
}

/** Provides injectable clock and row-version behavior for deterministic tests. */
export interface CacheKernelOptions {
  now?: () => number;
  getRecordVersion?: (record: CacheRecord) => number | undefined;
}

/** Signals that a session reset invalidated an in-flight cache read. */
export class CacheEpochChangedError extends Error {
  public constructor() {
    super('Cache session changed while data was loading.');
    this.name = 'CacheEpochChangedError';
  }
}

/** Receives changes to one canonical record; `null` means removed or purged. */
type RecordSubscriber = (record: CacheRecord | null) => void;

/** Receives query snapshots; `null` means the projection is invalid. */
type QuerySubscriber = (query: CacheQuerySnapshot | null) => void;

/** Stores a canonical record together with freshness and completeness metadata. */
interface StoredRecord {
  record: CacheRecord;
  version?: number;
  updatedAt: number;
  completeness: RecordCompleteness;
  stale: boolean;
}

/** Stores an ordered query projection and its dependency invalidation policy. */
interface StoredQuery extends CacheQuerySnapshot {
  stale: boolean;
  ttlMs?: number;
}

/**
 * Normalized, dependency-aware client cache.
 *
 * Records are stored once by namespace and id. Queries only store ordered ids
 * and dependency tokens, so list projections cannot become a second source of
 * truth for the records they display.
 */
export class CacheKernel {
  /** Canonical records, keyed by namespace and stable identifier. */
  private readonly records = new Map<string, StoredRecord>();
  /** Query projections containing ids and dependencies, never duplicate records. */
  private readonly queries = new Map<string, StoredQuery>();
  /** De-duplicates concurrent loads for the same query key. */
  private readonly queryLoads = new Map<string, Promise<CacheQuerySnapshot>>();
  /** Records queries invalidated while their loader is still running. */
  private readonly invalidatedQueriesDuringLoad = new Set<string>();
  /** Subscribers notified when canonical records change or become stale. */
  private readonly recordSubscribers = new Map<string, Set<RecordSubscriber>>();
  /** Subscribers notified when a query projection is ready or invalidated. */
  private readonly querySubscribers = new Map<string, Set<QuerySubscriber>>();
  /** Monotonic generations used to detect dependency changes during loads. */
  private readonly tokenGenerations = new Map<string, number>();
  /** Session generation incremented when all cached state is purged. */
  private epoch = 0;
  /** Prevents a degraded transport from certifying a browser snapshot as current. */
  private readModelTrusted = true;
  /** Clock used for TTL and update timestamps. */
  private readonly now: () => number;
  /** Extracts optimistic row versions without coupling the kernel to a model. */
  private readonly getRecordVersion: (record: CacheRecord) => number | undefined;

  /** Creates an isolated cache kernel with production defaults or test policies. */
  public constructor(options: CacheKernelOptions = {}) {
    this.now = options.now ?? (() => Date.now());
    this.getRecordVersion = options.getRecordVersion ?? ((record) => {
      const rowVersion = (record as { rowVersion?: unknown }).rowVersion;
      return typeof rowVersion === 'number' ? rowVersion : undefined;
    });
  }

  /** Builds the single key used by all canonical record operations. */
  private recordKey(namespace: string, id: string): string {
    return `${namespace}:${id}`;
  }

  /** Returns the current session epoch for in-flight load validation. */
  public getEpoch(): number {
    return this.epoch;
  }

  /** Sets the single freshness policy used by every normalized cache facade. */
  public setReadModelTrusted(trusted: boolean): void {
    this.readModelTrusted = trusted;
  }

  /** Reads one canonical record without exposing the internal storage wrapper. */
  public getRecord<T extends CacheRecord>(namespace: string, id: string): T | null {
    return (this.records.get(this.recordKey(namespace, id))?.record as T | undefined) ?? null;
  }

  /** Reports whether a record satisfies the completeness requested by a view. */
  public getRecordSatisfaction(
    namespace: string,
    id: string,
    requiredCompleteness: RecordCompleteness = 'summary',
  ): RecordSatisfaction {
    const stored = this.records.get(this.recordKey(namespace, id));
    if (!stored) return 'missing';
    if (!this.readModelTrusted) return 'stale';
    if (stored.stale) return 'stale';
    if (requiredCompleteness === 'full' && stored.completeness !== 'full') return 'incomplete';
    return 'satisfied';
  }

  /** Merges a newer record into canonical storage and notifies its subscribers. */
  public upsertRecord<T extends CacheRecord>(
    namespace: string,
    record: T,
    options: CacheRecordWriteOptions = {},
  ): boolean {
    const key = this.recordKey(namespace, record.id);
    const current = this.records.get(key);
    const incomingVersion = this.getRecordVersion(record);
    const incomingCompleteness = options.completeness ?? 'full';

    if (
      current?.version !== undefined &&
      incomingVersion !== undefined &&
      incomingVersion < current.version
    ) {
      return false;
    }

    const isNewerVersion =
      incomingVersion !== undefined &&
      (current?.version === undefined || incomingVersion > current.version);
    const completeness = isNewerVersion
      ? incomingCompleteness
      : current?.completeness === 'full' || incomingCompleteness === 'full'
        ? 'full'
        : 'summary';

    const next: StoredRecord = {
      record:
        current?.version !== undefined &&
        incomingVersion === undefined &&
        incomingCompleteness === 'summary'
          ? { ...record, ...current.record }
          : { ...current?.record, ...record },
      version: incomingVersion ?? current?.version,
      updatedAt: this.now(),
      completeness,
      stale: false,
    };
    this.records.set(key, next);
    this.recordSubscribers.get(key)?.forEach((subscriber) => subscriber(next.record));
    return true;
  }

  /** Removes a canonical record and notifies consumers that it disappeared. */
  public removeRecord(namespace: string, id: string): void {
    const key = this.recordKey(namespace, id);
    this.records.delete(key);
    this.recordSubscribers.get(key)?.forEach((subscriber) => subscriber(null));
  }

  /** Marks a record stale while retaining its last known value for rendering. */
  /** Notifies consumers that a record may need revalidation without deleting its value. */
  public invalidateRecord(namespace: string, id: string): void {
    const key = this.recordKey(namespace, id);
    const stored = this.records.get(key);
    if (stored) stored.stale = true;
    const record = stored?.record ?? null;
    this.recordSubscribers.get(key)?.forEach((subscriber) => subscriber(record));
  }

  /** Subscribes to one record and immediately emits its current value. */
  public subscribeRecord(namespace: string, id: string, subscriber: RecordSubscriber): () => void {
    const key = this.recordKey(namespace, id);
    const subscribers = this.recordSubscribers.get(key) ?? new Set<RecordSubscriber>();
    subscribers.add(subscriber);
    this.recordSubscribers.set(key, subscribers);
    subscriber(this.records.get(key)?.record ?? null);
    return () => {
      subscribers.delete(subscriber);
      if (subscribers.size === 0) this.recordSubscribers.delete(key);
    };
  }

  /** Returns a fresh query projection, or null when it must be reloaded. */
  public getQuery(key: string): CacheQuerySnapshot | null {
    const query = this.queries.get(key);
    if (!this.readModelTrusted || !query || query.stale || (query.ttlMs !== undefined && this.now() - query.fetchedAt >= query.ttlMs)) {
      return null;
    }
    return query;
  }

  /** Resolves query ids through the canonical store for complete row data. */
  /** Resolves a query projection back to the single canonical record store. */
  public resolveQueryRecords<T extends CacheRecord>(snapshot: CacheQuerySnapshot): T[] {
    if (!snapshot.recordNamespace) {
      throw new Error(`Query ${snapshot.key} has no record namespace`);
    }
    return snapshot.ids
      .map((id) => this.getRecord<T>(snapshot.recordNamespace!, id))
      .filter((record): record is T => record !== null);
  }

  /** Loads, validates, stores, and publishes a dependency-aware query projection. */
  public readQuery(
    key: string,
    loader: () => Promise<CacheQueryLoaderResult>,
    options: CacheQueryOptions = {}
  ): Promise<CacheQuerySnapshot> {
    const cached = this.getQuery(key);
    if (cached) return Promise.resolve(cached);

    const pending = this.queryLoads.get(key);
    if (pending) return pending;

    const knownDependencies = options.dependencies ?? this.queries.get(key)?.dependencies ?? [];
    const startingEpoch = this.epoch;
    const startingGenerations = new Map(
      knownDependencies.map((token) => [token, this.tokenGenerations.get(token) ?? 0])
    );
    const load = loader().then((result) => {
      if (this.epoch !== startingEpoch) throw new CacheEpochChangedError();
      const dependencies = [...new Set(result.dependencies ?? knownDependencies)];
      const changedDuringLoad = dependencies.some((token) => (
        (this.tokenGenerations.get(token) ?? 0) !== (startingGenerations.get(token) ?? 0)
      ));

      if (changedDuringLoad || this.invalidatedQueriesDuringLoad.has(key)) {
        this.queryLoads.delete(key);
        this.invalidatedQueriesDuringLoad.delete(key);
        return this.readQuery(key, loader, options);
      }

      const snapshot: StoredQuery = {
        key,
        recordNamespace: result.recordNamespace ?? options.recordNamespace,
        ids: [...result.ids],
        dependencies,
        generation: Math.max(...dependencies.map((token) => this.tokenGenerations.get(token) ?? 0), 0),
        fetchedAt: this.now(),
        stale: false,
        ttlMs: options.ttlMs,
      };
      this.queries.set(key, snapshot);
      this.querySubscribers.get(key)?.forEach((subscriber) => subscriber(snapshot));
      return snapshot;
    }).finally(() => {
      if (this.queryLoads.get(key) === load) this.queryLoads.delete(key);
    });

    this.queryLoads.set(key, load);
    return load;
  }

  /** Subscribes to one query projection and immediately emits its current value. */
  public subscribeQuery(key: string, subscriber: QuerySubscriber): () => void {
    const subscribers = this.querySubscribers.get(key) ?? new Set<QuerySubscriber>();
    subscribers.add(subscriber);
    this.querySubscribers.set(key, subscribers);
    subscriber(this.queries.get(key) ?? null);
    return () => {
      subscribers.delete(subscriber);
      if (subscribers.size === 0) this.querySubscribers.delete(key);
    };
  }

  /** Invalidates one projection and reschedules it if a load is in progress. */
  public invalidateQuery(key: string): void {
    if (this.queryLoads.has(key)) this.invalidatedQueriesDuringLoad.add(key);
    const query = this.queries.get(key);
    if (!query) return;
    query.stale = true;
    this.querySubscribers.get(key)?.forEach((subscriber) => subscriber(null));
  }

  /** Invalidates every query depending on a token generation. */
  public invalidateToken(token: string): void {
    this.tokenGenerations.set(token, (this.tokenGenerations.get(token) ?? 0) + 1);
    for (const query of this.queries.values()) {
      if (query.dependencies.includes(token)) {
        query.stale = true;
        this.querySubscribers.get(query.key)?.forEach((subscriber) => subscriber(null));
      }
    }
  }

  /** Runs a mutation and applies its canonical writes and invalidations atomically. */
  public async mutate<TResult>(operation: () => Promise<TResult>, options: CacheMutationOptions<TResult>): Promise<TResult> {
    const result = await operation();
    options.commit?.(result, this);
    options.invalidateQueries?.forEach((key) => this.invalidateQuery(key));
    options.invalidateTokens?.forEach((token) => this.invalidateToken(token));
    return result;
  }

  /** Clears all records, projections, subscriptions, and in-flight state. */
  public purge(): void {
    this.epoch += 1;
    for (const subscribers of this.recordSubscribers.values()) subscribers.forEach((subscriber) => subscriber(null));
    for (const subscribers of this.querySubscribers.values()) subscribers.forEach((subscriber) => subscriber(null));
    this.records.clear();
    this.queries.clear();
    this.queryLoads.clear();
    this.invalidatedQueriesDuringLoad.clear();
    this.tokenGenerations.clear();
  }

  /** Clears records in one namespace while preserving unrelated cache state. */
  public purgeNamespace(namespace: string): void {
    const prefix = `${namespace}:`;
    for (const key of [...this.records.keys()]) {
      if (!key.startsWith(prefix)) continue;
      this.records.delete(key);
      this.recordSubscribers.get(key)?.forEach((subscriber) => subscriber(null));
    }
  }

  /** Exposes cache cardinalities for diagnostics without exposing record contents. */
  public get sizes(): { records: number; queries: number; pendingQueries: number } {
    return {
      records: this.records.size,
      queries: this.queries.size,
      pendingQueries: this.queryLoads.size,
    };
  }
}
