export interface CacheRecord {
  id: string;
}

export type RecordCompleteness = 'summary' | 'full';
export type RecordSatisfaction = 'missing' | 'incomplete' | 'stale' | 'satisfied';

export interface CacheRecordWriteOptions {
  completeness?: RecordCompleteness;
}

export interface CacheQuerySnapshot {
  readonly key: string;
  readonly recordNamespace?: string;
  readonly ids: readonly string[];
  readonly dependencies: readonly string[];
  readonly generation: number;
  readonly fetchedAt: number;
}

export interface CacheQueryLoaderResult {
  ids: readonly string[];
  recordNamespace?: string;
  dependencies?: readonly string[];
}

export interface CacheQueryOptions {
  recordNamespace?: string;
  dependencies?: readonly string[];
  ttlMs?: number;
}

export interface CacheMutationOptions<TResult> {
  commit?: (result: TResult, kernel: CacheKernel) => void;
  invalidateTokens?: readonly string[];
  invalidateQueries?: readonly string[];
}

export interface CacheKernelOptions {
  now?: () => number;
  getRecordVersion?: (record: CacheRecord) => number | undefined;
}

export class CacheEpochChangedError extends Error {
  public constructor() {
    super('Cache session changed while data was loading.');
    this.name = 'CacheEpochChangedError';
  }
}

type RecordSubscriber = (record: CacheRecord | null) => void;
type QuerySubscriber = (query: CacheQuerySnapshot | null) => void;

interface StoredRecord {
  record: CacheRecord;
  version?: number;
  updatedAt: number;
  completeness: RecordCompleteness;
  stale: boolean;
}

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
  private readonly records = new Map<string, StoredRecord>();
  private readonly queries = new Map<string, StoredQuery>();
  private readonly queryLoads = new Map<string, Promise<CacheQuerySnapshot>>();
  private readonly invalidatedQueriesDuringLoad = new Set<string>();
  private readonly recordSubscribers = new Map<string, Set<RecordSubscriber>>();
  private readonly querySubscribers = new Map<string, Set<QuerySubscriber>>();
  private readonly tokenGenerations = new Map<string, number>();
  private epoch = 0;
  private readonly now: () => number;
  private readonly getRecordVersion: (record: CacheRecord) => number | undefined;

  public constructor(options: CacheKernelOptions = {}) {
    this.now = options.now ?? (() => Date.now());
    this.getRecordVersion = options.getRecordVersion ?? ((record) => {
      const rowVersion = (record as { rowVersion?: unknown }).rowVersion;
      return typeof rowVersion === 'number' ? rowVersion : undefined;
    });
  }

  private recordKey(namespace: string, id: string): string {
    return `${namespace}:${id}`;
  }

  public getEpoch(): number {
    return this.epoch;
  }

  public getRecord<T extends CacheRecord>(namespace: string, id: string): T | null {
    return (this.records.get(this.recordKey(namespace, id))?.record as T | undefined) ?? null;
  }

  public getRecordSatisfaction(
    namespace: string,
    id: string,
    requiredCompleteness: RecordCompleteness = 'summary',
  ): RecordSatisfaction {
    const stored = this.records.get(this.recordKey(namespace, id));
    if (!stored) return 'missing';
    if (stored.stale) return 'stale';
    if (requiredCompleteness === 'full' && stored.completeness !== 'full') return 'incomplete';
    return 'satisfied';
  }

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

  public removeRecord(namespace: string, id: string): void {
    const key = this.recordKey(namespace, id);
    this.records.delete(key);
    this.recordSubscribers.get(key)?.forEach((subscriber) => subscriber(null));
  }

  /** Notifies consumers that a record may need revalidation without deleting its value. */
  public invalidateRecord(namespace: string, id: string): void {
    const key = this.recordKey(namespace, id);
    const stored = this.records.get(key);
    if (stored) stored.stale = true;
    const record = stored?.record ?? null;
    this.recordSubscribers.get(key)?.forEach((subscriber) => subscriber(record));
  }

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

  public getQuery(key: string): CacheQuerySnapshot | null {
    const query = this.queries.get(key);
    if (!query || query.stale || (query.ttlMs !== undefined && this.now() - query.fetchedAt >= query.ttlMs)) {
      return null;
    }
    return query;
  }

  /** Resolves a query projection back to the single canonical record store. */
  public resolveQueryRecords<T extends CacheRecord>(snapshot: CacheQuerySnapshot): T[] {
    if (!snapshot.recordNamespace) {
      throw new Error(`Query ${snapshot.key} has no record namespace`);
    }
    return snapshot.ids
      .map((id) => this.getRecord<T>(snapshot.recordNamespace!, id))
      .filter((record): record is T => record !== null);
  }

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

  public invalidateQuery(key: string): void {
    if (this.queryLoads.has(key)) this.invalidatedQueriesDuringLoad.add(key);
    const query = this.queries.get(key);
    if (!query) return;
    query.stale = true;
    this.querySubscribers.get(key)?.forEach((subscriber) => subscriber(null));
  }

  public invalidateToken(token: string): void {
    this.tokenGenerations.set(token, (this.tokenGenerations.get(token) ?? 0) + 1);
    for (const query of this.queries.values()) {
      if (query.dependencies.includes(token)) {
        query.stale = true;
        this.querySubscribers.get(query.key)?.forEach((subscriber) => subscriber(null));
      }
    }
  }

  public async mutate<TResult>(operation: () => Promise<TResult>, options: CacheMutationOptions<TResult>): Promise<TResult> {
    const result = await operation();
    options.commit?.(result, this);
    options.invalidateQueries?.forEach((key) => this.invalidateQuery(key));
    options.invalidateTokens?.forEach((token) => this.invalidateToken(token));
    return result;
  }

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

  public purgeNamespace(namespace: string): void {
    const prefix = `${namespace}:`;
    for (const key of [...this.records.keys()]) {
      if (!key.startsWith(prefix)) continue;
      this.records.delete(key);
      this.recordSubscribers.get(key)?.forEach((subscriber) => subscriber(null));
    }
  }

  public get sizes(): { records: number; queries: number; pendingQueries: number } {
    return {
      records: this.records.size,
      queries: this.queries.size,
      pendingQueries: this.queryLoads.size,
    };
  }
}
