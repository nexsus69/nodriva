/** Verifies normalized cache records, query invalidation, epochs, and shared freshness policy. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CacheEpochChangedError, CacheKernel } from './CacheKernel';

interface TestRecord {
  id: string;
  name: string;
  rowVersion: number;
}

describe('CacheKernel', () => {
  let now: number;
  let kernel: CacheKernel;

  beforeEach(() => {
    now = 1_000;
    kernel = new CacheKernel({ now: () => now });
  });

  it('stores one canonical record while queries keep only ordered ids', async () => {
    const record: TestRecord = { id: 'customer-1', name: 'Customer', rowVersion: 1 };
    kernel.upsertRecord('entity-type', record);

    const query = await kernel.readQuery('metadata:entity', async () => ({
      ids: [record.id],
      recordNamespace: 'entity-type',
      dependencies: ['entity-types'],
    }));

    expect(query.ids).toEqual(['customer-1']);
    expect(query.recordNamespace).toBe('entity-type');
    expect(kernel.resolveQueryRecords<TestRecord>(query)).toEqual([record]);
    expect(kernel.getRecord<TestRecord>('entity-type', query.ids[0]!)).toEqual(record);
    expect(kernel.sizes).toEqual({ records: 1, queries: 1, pendingQueries: 0 });
  });

  it('does not duplicate query payloads and omits records removed from the canonical store', async () => {
    kernel.upsertRecord<TestRecord>('entity', { id: '1', name: 'A', rowVersion: 1 });
    kernel.upsertRecord<TestRecord>('entity', { id: '2', name: 'B', rowVersion: 1 });
    const query = await kernel.readQuery('entities', async () => ({
      ids: ['1', '2'],
      recordNamespace: 'entity',
    }));

    kernel.removeRecord('entity', '1');

    expect(kernel.resolveQueryRecords<TestRecord>(query)).toEqual([{ id: '2', name: 'B', rowVersion: 1 }]);
  });

  it('deduplicates concurrent query loads', async () => {
    let resolve: ((value: { ids: string[] }) => void) | undefined;
    const loader = vi.fn(() => new Promise<{ ids: string[] }>((finish) => { resolve = finish; }));

    const first = kernel.readQuery('metadata:entity', loader);
    const second = kernel.readQuery('metadata:entity', loader);

    expect(first).toBe(second);
    expect(loader).toHaveBeenCalledTimes(1);
    resolve!({ ids: ['entity-type-1'] });
    await expect(first).resolves.toMatchObject({ ids: ['entity-type-1'] });
  });

  it('ignores an older version and accepts a newer version', () => {
    kernel.upsertRecord<TestRecord>('entity', { id: '1', name: 'New', rowVersion: 2 });

    expect(kernel.upsertRecord<TestRecord>('entity', { id: '1', name: 'Old', rowVersion: 1 })).toBe(false);
    expect(kernel.getRecord<TestRecord>('entity', '1')?.name).toBe('New');
    expect(kernel.upsertRecord<TestRecord>('entity', { id: '1', name: 'Newest', rowVersion: 3 })).toBe(true);
    expect(kernel.getRecord<TestRecord>('entity', '1')?.name).toBe('Newest');
  });

  it('distinguishes missing, partial, stale and complete canonical records', () => {
    expect(kernel.getRecordSatisfaction('entity', '1', 'full')).toBe('missing');

    kernel.upsertRecord<TestRecord>(
      'entity',
      { id: '1', name: 'Summary', rowVersion: 1 },
      { completeness: 'summary' },
    );
    expect(kernel.getRecordSatisfaction('entity', '1', 'summary')).toBe('satisfied');
    expect(kernel.getRecordSatisfaction('entity', '1', 'full')).toBe('incomplete');

    kernel.invalidateRecord('entity', '1');
    expect(kernel.getRecordSatisfaction('entity', '1', 'summary')).toBe('stale');

    kernel.upsertRecord<TestRecord>(
      'entity',
      { id: '1', name: 'Complete', rowVersion: 1 },
      { completeness: 'full' },
    );
    expect(kernel.getRecordSatisfaction('entity', '1', 'full')).toBe('satisfied');
  });

  it('requires an authoritative reread while the shared read model is not trusted', async () => {
    kernel.upsertRecord<TestRecord>('entity', { id: '1', name: 'Cached', rowVersion: 1 });
    const loader = vi.fn(async () => ({ ids: ['1'], recordNamespace: 'entity' }));
    await kernel.readQuery('entities', loader, { recordNamespace: 'entity' });

    kernel.setReadModelTrusted(false);

    expect(kernel.getRecordSatisfaction('entity', '1')).toBe('stale');
    expect(kernel.getQuery('entities')).toBeNull();
    await kernel.readQuery('entities', loader, { recordNamespace: 'entity' });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('does not retain full completeness when a newer partial version arrives', () => {
    kernel.upsertRecord<TestRecord>('entity', { id: '1', name: 'Complete', rowVersion: 1 });
    kernel.upsertRecord<TestRecord>(
      'entity',
      { id: '1', name: 'New summary', rowVersion: 2 },
      { completeness: 'summary' },
    );

    expect(kernel.getRecord<TestRecord>('entity', '1')?.name).toBe('New summary');
    expect(kernel.getRecordSatisfaction('entity', '1', 'full')).toBe('incomplete');
  });

  it('does not let an unversioned summary overwrite a versioned canonical record', () => {
    kernel.upsertRecord<TestRecord>('entity', { id: '1', name: 'Canonical', rowVersion: 2 });
    kernel.upsertRecord(
      'entity',
      { id: '1', name: 'Unversioned summary' },
      { completeness: 'summary' },
    );

    expect(kernel.getRecord<TestRecord>('entity', '1')?.name).toBe('Canonical');
    expect(kernel.getRecordSatisfaction('entity', '1', 'full')).toBe('satisfied');
  });

  it('invalidates every query that depends on a token', async () => {
    await kernel.readQuery('metadata:entity', async () => ({ ids: ['1'], dependencies: ['entity-types'] }));
    await kernel.readQuery('metadata:node', async () => ({ ids: ['2'], dependencies: ['node-types'] }));
    const entitySubscriber = vi.fn();
    kernel.subscribeQuery('metadata:entity', entitySubscriber);

    kernel.invalidateToken('entity-types');

    expect(kernel.getQuery('metadata:entity')).toBeNull();
    expect(kernel.getQuery('metadata:node')).not.toBeNull();
    expect(entitySubscriber).toHaveBeenLastCalledWith(null);
  });

  it('invalidates a query and reloads it with fresh ids', async () => {
    let version = 1;
    const loader = vi.fn(async () => ({ ids: [`type-${version}`], dependencies: ['types'] }));

    await expect(kernel.readQuery('types:entity', loader)).resolves.toMatchObject({ ids: ['type-1'] });
    kernel.invalidateQuery('types:entity');
    version = 2;

    await expect(kernel.readQuery('types:entity', loader)).resolves.toMatchObject({ ids: ['type-2'] });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('supports coordinated mutations that commit records and invalidate dependencies', async () => {
    await kernel.readQuery('metadata:entity', async () => ({ ids: ['old'], dependencies: ['entity-types'] }));

    await kernel.mutate(
      async () => ({ id: 'new', name: 'New', rowVersion: 1 } satisfies TestRecord),
      {
        commit: (result, cache) => {
          cache.upsertRecord('entity-type', result);
        },
        invalidateTokens: ['entity-types'],
      }
    );

    expect(kernel.getRecord<TestRecord>('entity-type', 'new')?.name).toBe('New');
    expect(kernel.getQuery('metadata:entity')).toBeNull();
  });

  it('restarts a query when its dependency changes while loading', async () => {
    let resolveFirst: ((value: { ids: string[] }) => void) | undefined;
    const loader = vi.fn()
      .mockImplementationOnce(() => new Promise<{ ids: string[] }>((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ ids: ['fresh'] });

    const pending = kernel.readQuery('metadata:entity', loader, { dependencies: ['entity-types'] });
    kernel.invalidateToken('entity-types');
    resolveFirst!({ ids: ['stale'] });

    await expect(pending).resolves.toMatchObject({ ids: ['fresh'] });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('expires queries according to their TTL', async () => {
    const loader = vi.fn(async () => ({ ids: ['1'] }));
    await kernel.readQuery('short-lived', loader, { ttlMs: 100 });
    now += 99;
    await kernel.readQuery('short-lived', loader, { ttlMs: 100 });
    expect(loader).toHaveBeenCalledTimes(1);
    now += 1;
    await kernel.readQuery('short-lived', loader, { ttlMs: 100 });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('purges records, queries and pending state for a session reset', async () => {
    kernel.upsertRecord<TestRecord>('entity', { id: '1', name: 'Private', rowVersion: 1 });
    await kernel.readQuery('private-list', async () => ({ ids: ['1'] }));
    const recordSubscriber = vi.fn();
    const querySubscriber = vi.fn();
    kernel.subscribeRecord('entity', '1', recordSubscriber);
    kernel.subscribeQuery('private-list', querySubscriber);

    kernel.purge();

    expect(kernel.getRecord('entity', '1')).toBeNull();
    expect(kernel.getQuery('private-list')).toBeNull();
    expect(kernel.sizes).toEqual({ records: 0, queries: 0, pendingQueries: 0 });
    expect(recordSubscriber).toHaveBeenLastCalledWith(null);
    expect(querySubscriber).toHaveBeenLastCalledWith(null);
  });

  it('rejects a query response that completes after a session purge', async () => {
    let resolveRequest: ((value: { ids: string[] }) => void) | undefined;
    const pending = kernel.readQuery('private-list', () => new Promise((resolve) => {
      resolveRequest = resolve;
    }));

    kernel.purge();
    resolveRequest!({ ids: ['private-record'] });

    await expect(pending).rejects.toBeInstanceOf(CacheEpochChangedError);
    expect(kernel.getQuery('private-list')).toBeNull();
  });
});
