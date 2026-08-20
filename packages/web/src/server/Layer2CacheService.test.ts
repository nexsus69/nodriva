import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../app/actions/entityActions', () => ({
  getEntityByIdAction: vi.fn(),
  createEntityAction: vi.fn(),
  updateEntityAction: vi.fn(),
  deleteEntityAction: vi.fn(),
  listSubtreeEntitiesAction: vi.fn(),
}));

vi.mock('../app/actions/nodeActions', () => ({
  getNodeByIdAction: vi.fn(),
  getNodeBreadcrumbAction: vi.fn(),
  createNodeAction: vi.fn(),
  updateNodeAction: vi.fn(),
  moveNodeAction: vi.fn(),
}));
import { GlobalViewStore, flattenViewPages } from '../app/cache/ViewStore';
import { IngestionLayer, SatisfiabilityEvaluator, ViewResolver } from '../app/cache/CacheService';
import {
  createEntityAction,
  deleteEntityAction,
  listSubtreeEntitiesAction,
  updateEntityAction,
} from '../app/actions/entityActions';
import { getNodeBreadcrumbAction, moveNodeAction } from '../app/actions/nodeActions';
import { GlobalPolicyRegistry } from '../app/cache/PolicyRegistry';
import { CacheGarbageCollector } from '../app/cache/CacheGarbageCollector';
import { AppCache } from '../app/cache/GlobalCacheClient';

describe('Layer 2 (CacheService) - GC and Window Trimming', () => {
  const viewKey = 'SUBTREE_LIST|baseNodeId:test-node-1';

  beforeEach(() => {
    AppCache.purgeAll();
    AppCache['entityCaches'].clear();
  });

  it('purgeAll removes entity data, views, and retention leases', () => {
    GlobalViewStore.set(viewKey, {
      viewKey,
      pages: [],
      status: 'success',
      error: null,
      satisfactionStatus: 'satisfied',
      updatedAt: Date.now(),
    });
    GlobalPolicyRegistry.retain('view', viewKey, 'test-owner', 'sticky');
    AppCache.getEntityCache('device').inject('e1', { id: 'e1', name: 'Device' });

    AppCache.purgeAll();

    expect(GlobalViewStore.get(viewKey)).toBeNull();
    expect(GlobalPolicyRegistry.shouldEvict('view', viewKey)).toBe(true);
    expect(AppCache.getEntityCache('device').get('e1')).toBeNull();
  });

  it('hydrates a cold breadcrumb view and refetches when a canonical node is missing', async () => {
    const breadcrumbKey = 'BREADCRUMB|baseNodeId:child';
    const nodes = [
      { id: 'root', parentId: null, path: 'root', pathLabel: 'root', depth: 0, nodeTypeId: 'folder', name: 'Root', description: '', rowVersion: 1, payload: {} },
      { id: 'child', parentId: 'root', path: 'root.child', pathLabel: 'child', depth: 1, nodeTypeId: 'folder', name: 'Child', description: '', rowVersion: 1, payload: {} },
    ];
    vi.mocked(getNodeBreadcrumbAction).mockResolvedValue(nodes);

    await ViewResolver.resolve({
      type: 'resolve',
      params: { viewType: 'BREADCRUMB', baseNodeId: 'child' },
      requireComplete: true,
    });

    expect(
      flattenViewPages(GlobalViewStore.get(breadcrumbKey)).flatMap((item) =>
        item.type === 'row' ? [item.id] : [],
      ),
    ).toEqual(['root', 'child']);
    expect(AppCache.nodes.get('root')?.name).toBe('Root');
    expect(AppCache.nodes.get('child')?.name).toBe('Child');

    AppCache.nodes.remove('root');
    expect(SatisfiabilityEvaluator.evaluate(breadcrumbKey, true)).toBe('missing-records');
  });

  it('invalidates breadcrumb views after moving a node', async () => {
    const breadcrumbKey = 'BREADCRUMB|baseNodeId:child';
    GlobalViewStore.set(breadcrumbKey, {
      viewKey: breadcrumbKey,
      pages: [],
      status: 'success',
      error: null,
      satisfactionStatus: 'satisfied',
      updatedAt: Date.now(),
    });
    vi.mocked(moveNodeAction).mockResolvedValue({
      id: 'child',
      parentId: 'new-parent',
      name: 'Child',
    } as never);

    await AppCache.moveNode({
      nodeId: 'child',
      newParentNodeId: 'new-parent',
      expectedNodeRowVersion: 1,
    });

    expect(GlobalViewStore.get(breadcrumbKey)).toBeNull();
  });

  it('invalidates entity read models for structural mutations but preserves update views', async () => {
    const viewKeys = [
      'SUBTREE_LIST|baseNodeId:test-node-1',
      'NODE_ENTITY_COLLECTION|baseNodeId:test-node-1',
      'ENTITY_DETAIL|entityId:e1',
      'NODE_CHILDREN_LIST|baseNodeId:test-node-1',
    ];
    for (const key of viewKeys) {
      GlobalViewStore.set(key, {
        viewKey: key,
        pages: [],
        status: 'success',
        error: null,
        satisfactionStatus: 'satisfied',
        updatedAt: Date.now(),
      });
    }

    const entity = {
      id: 'e1',
      entityTypeId: 'device',
      parentNodeId: 'test-node-1',
      name: 'Device',
      description: '',
      rowVersion: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      payload: {},
    };
    vi.mocked(createEntityAction).mockResolvedValue({ success: true, data: entity });
    vi.mocked(updateEntityAction).mockResolvedValue({ success: true, data: { ...entity, name: 'Updated', rowVersion: 2 } });
    vi.mocked(deleteEntityAction).mockResolvedValue({ success: true, data: undefined });

    await AppCache.createEntity({ parentNodeId: entity.parentNodeId, entityTypeId: entity.entityTypeId, name: entity.name });
    expect(GlobalViewStore.get('SUBTREE_LIST|baseNodeId:test-node-1')).toBeNull();
    expect(GlobalViewStore.get('NODE_ENTITY_COLLECTION|baseNodeId:test-node-1')).toBeNull();
    expect(GlobalViewStore.get('ENTITY_DETAIL|entityId:e1')).toBeNull();
    expect(GlobalViewStore.get('NODE_CHILDREN_LIST|baseNodeId:test-node-1')).not.toBeNull();

    GlobalViewStore.set('ENTITY_DETAIL|entityId:e1', {
      viewKey: 'ENTITY_DETAIL|entityId:e1',
      pages: [],
      status: 'success',
      error: null,
      satisfactionStatus: 'satisfied',
      updatedAt: Date.now(),
    });
    await AppCache.updateEntity({ entityId: entity.id, name: 'Updated', expectedRowVersion: 1 });
    expect(GlobalViewStore.get('ENTITY_DETAIL|entityId:e1')).not.toBeNull();

    GlobalViewStore.set('SUBTREE_LIST|baseNodeId:test-node-1', {
      viewKey: 'SUBTREE_LIST|baseNodeId:test-node-1',
      pages: [],
      status: 'success',
      error: null,
      satisfactionStatus: 'satisfied',
      updatedAt: Date.now(),
    });
    await AppCache.deleteEntity(entity.id, entity.entityTypeId, entity.rowVersion);
    expect(GlobalViewStore.get('SUBTREE_LIST|baseNodeId:test-node-1')).toBeNull();
  });

  it('keeps the validation failure serializable and does not mutate the cache', async () => {
    vi.mocked(createEntityAction).mockResolvedValue({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dynamic schema validation failed for entity payload.',
      },
    });

    await expect(AppCache.createEntity({
      parentNodeId: 'test-node-1',
      entityTypeId: 'device',
      name: 'Invalid device',
      payload: { email: 'not-an-email' },
    })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Dynamic schema validation failed for entity payload.',
    });

    expect(AppCache.getEntityCache('device').get('invalid-device')).toBeNull();
  });

  it('builds identical keys for semantically identical nested filters', async () => {
    const { ViewKeyBuilder } = await import('../app/cache/SemanticViewKey');
    const first = ViewKeyBuilder.build({
      viewType: 'SUBTREE_LIST',
      filters: { nested: { b: 2, a: 1 }, values: ['x', 'y'] },
    });
    const second = ViewKeyBuilder.build({
      viewType: 'SUBTREE_LIST',
      filters: { values: ['x', 'y'], nested: { a: 1, b: 2 } },
    });

    expect(first).toBe(second);
  });

  it('keeps descriptors when refreshing an existing view with the same rows', () => {
    const items = [
      { id: 'e1', parentNodeId: 'test-node-1', entityTypeId: 'device', nodeName: 'N1', name: 'Device 1' },
      { id: 'e2', parentNodeId: 'test-node-1', entityTypeId: 'device', nodeName: 'N1', name: 'Device 2' },
    ];
    IngestionLayer.ingestSubtreeList(viewKey, items, false, undefined, undefined, 'resolve');
    IngestionLayer.ingestSubtreeList(viewKey, items, false, undefined, undefined, 'resolve');

    expect(GlobalViewStore.get(viewKey)?.pages[0].items).toHaveLength(2);
  });

  it('deduplicates rows repeated inside the same response', () => {
    const duplicate = {
      id: 'e1',
      parentNodeId: 'test-node-1',
      entityTypeId: 'device',
      nodeName: 'N1',
      name: 'Device 1',
    };
    IngestionLayer.ingestSubtreeList(
      viewKey,
      [duplicate, duplicate],
      false,
      undefined,
      undefined,
      'resolve'
    );

    expect(GlobalViewStore.get(viewKey)?.pages[0].items).toHaveLength(1);
  });

  it('stops pagination when an empty extension does not advance its cursor', () => {
    const cursor = { path: 'root', name: 'Device', id: 'e1' };
    IngestionLayer.ingestSubtreeList(
      viewKey,
      [{ id: 'e1', parentNodeId: 'test-node-1', entityTypeId: 'device', nodeName: 'N1', name: 'Device' }],
      true,
      undefined,
      cursor,
      'resolve'
    );
    IngestionLayer.ingestSubtreeList(
      viewKey,
      [],
      true,
      cursor,
      { ...cursor },
      'extend',
      'forward'
    );

    const view = GlobalViewStore.get(viewKey);
    expect(view?.pages.at(-1)?.hasMoreForward).toBe(false);
  });

  it('preserves every boundary row when reversing direction after trimming', () => {
    const makeItems = (from: number, to: number) =>
      Array.from({ length: to - from + 1 }, (_, index) => {
        const number = from + index;
        return {
          id: `00000000-0000-0000-0000-${String(number).padStart(12, '0')}`,
          parentNodeId: 'test-node-1',
          entityTypeId: 'device',
          nodeName: 'N1',
          nodePath: 'root',
          nodeDepth: 0,
          name: `Entity ${String(number).padStart(3, '0')}`,
        };
      });

    IngestionLayer.ingestSubtreeList(
      viewKey, makeItems(1, 15), true, undefined, undefined, 'resolve', undefined, 3
    );
    IngestionLayer.ingestSubtreeList(
      viewKey, makeItems(16, 30), true, undefined, undefined, 'extend', 'forward', 3
    );
    IngestionLayer.ingestSubtreeList(
      viewKey, makeItems(31, 45), true, undefined, undefined, 'extend', 'forward', 3
    );
    IngestionLayer.ingestSubtreeList(
      viewKey, makeItems(46, 60), false, undefined, undefined, 'extend', 'forward', 3
    );

    expect(GlobalViewStore.get(viewKey)?.pages[0].prevCursor).toEqual({
      path: 'root',
      name: 'Entity 016',
      id: '00000000-0000-0000-0000-000000000016',
    });

    IngestionLayer.ingestSubtreeList(
      viewKey, makeItems(1, 15), false, undefined, undefined, 'extend', 'backward', 3
    );

    const ids = flattenViewPages(GlobalViewStore.get(viewKey))
      .filter((item) => item.type === 'row')
      .map((item) => item.id);
    expect(ids).toHaveLength(45);
    expect(new Set(ids).size).toBe(45);
    expect(ids).toContain('00000000-0000-0000-0000-000000000015');
    expect(ids).toContain('00000000-0000-0000-0000-000000000016');
  });

  it('does not let a stale subtree response roll back an updated node', () => {
    AppCache.nodes.inject('test-node-1', {
      id: 'test-node-1',
      name: 'Updated node',
      rowVersion: 2,
    }, false);

    IngestionLayer.ingestSubtreeList(
      viewKey,
      [{
        id: 'entity-1',
        parentNodeId: 'test-node-1',
        entityTypeId: 'device',
        name: 'Entity 1',
        nodeName: 'Stale node name',
        nodePath: 'root',
        nodeDepth: 0,
        nodeRowVersion: 1,
      }],
      false,
      undefined,
      undefined,
      'resolve'
    );

    expect(AppCache.nodes.get('test-node-1')).toMatchObject({
      name: 'Updated node',
      rowVersion: 2,
    });
  });

  it('keeps a contiguous duplicate-free window through a full down-up-down cycle', () => {
    const pageSize = 15;
    const maxWindowChunks = 8;
    const totalItems = 169;
    const makeItems = (from: number, to: number) =>
      Array.from({ length: to - from + 1 }, (_, index) => {
        const number = from + index;
        return {
          id: `entity-${String(number).padStart(3, '0')}`,
          parentNodeId: 'test-node-1',
          entityTypeId: 'device',
          nodeName: 'N1',
          nodePath: 'root',
          nodeDepth: 0,
          name: `Entity ${String(number).padStart(3, '0')}`,
        };
      });
    const visibleNumbers = () =>
      flattenViewPages(GlobalViewStore.get(viewKey))
        .filter((item) => item.type === 'row')
        .map((item) => Number(item.id.replace('entity-', '')));
    const expectContiguousWindow = (from: number, to: number) => {
      const numbers = visibleNumbers();
      expect(numbers).toEqual(
        Array.from({ length: to - from + 1 }, (_, index) => from + index)
      );
      expect(new Set(numbers).size).toBe(numbers.length);
    };
    const ingestPage = (
      from: number,
      direction: 'forward' | 'backward',
      intentType: 'resolve' | 'extend' = 'extend'
    ) => {
      const to = Math.min(from + pageSize - 1, totalItems);
      const hasMore =
        direction === 'forward' ? to < totalItems : from > 1;
      IngestionLayer.ingestSubtreeList(
        viewKey,
        makeItems(from, to),
        hasMore,
        undefined,
        undefined,
        intentType,
        intentType === 'extend' ? direction : undefined,
        maxWindowChunks
      );
    };

    ingestPage(1, 'forward', 'resolve');
    for (let from = 16; from <= totalItems; from += pageSize) {
      ingestPage(from, 'forward');
    }

    expect(GlobalViewStore.get(viewKey)?.pages.map((page) => page.items.length))
      .toEqual([15, 15, 15, 15, 15, 15, 15, 4]);
    expectContiguousWindow(61, 169);

    for (const from of [46, 31, 16, 1]) {
      ingestPage(from, 'backward');
    }

    expect(GlobalViewStore.get(viewKey)?.pages.map((page) => page.items.length))
      .toEqual([15, 15, 15, 15, 15, 15, 15, 15]);
    expectContiguousWindow(1, 120);

    for (const from of [121, 136, 151, 166]) {
      ingestPage(from, 'forward');
    }

    expect(GlobalViewStore.get(viewKey)?.pages.map((page) => page.items.length))
      .toEqual([15, 15, 15, 15, 15, 15, 15, 4]);
    expectContiguousWindow(61, 169);
  });

  it('records the failed view and propagates fetch errors for directional retry', async () => {
    vi.mocked(listSubtreeEntitiesAction).mockRejectedValueOnce(new Error('temporary failure'));

    await expect(ViewResolver.resolve({
      type: 'resolve',
      params: { viewType: 'SUBTREE_LIST', baseNodeId: 'test-node-1' },
      requireComplete: false,
    })).rejects.toThrow('temporary failure');

    const failedView = GlobalViewStore.get(viewKey);
    expect(failedView?.status).toBe('error');
    expect(failedView?.error?.message).toBe('temporary failure');
  });

  it('treats empty stale and failed views as fetchable', () => {
    GlobalViewStore.set(viewKey, {
      viewKey,
      pages: [],
      status: 'success',
      error: null,
      satisfactionStatus: 'satisfied',
      updatedAt: Date.now() - 6 * 60 * 1000,
    });
    expect(SatisfiabilityEvaluator.evaluate(viewKey, false)).toBe('stale');

    GlobalViewStore.set(viewKey, {
      ...GlobalViewStore.get(viewKey)!,
      status: 'error',
      updatedAt: Date.now(),
    });
    expect(SatisfiabilityEvaluator.evaluate(viewKey, false)).toBe('stale');
  });

  it('deduplicates concurrent resolutions for the same semantic request', async () => {
    vi.mocked(listSubtreeEntitiesAction).mockClear();
    type SubtreeResponse = Awaited<ReturnType<typeof listSubtreeEntitiesAction>>;
    let resolveRequest: ((value: SubtreeResponse) => void) | undefined;
    vi.mocked(listSubtreeEntitiesAction).mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveRequest = resolve;
      })
    );
    const intent = {
      type: 'resolve' as const,
      params: { viewType: 'SUBTREE_LIST' as const, baseNodeId: 'test-node-1' },
      requireComplete: false,
    };

    const first = ViewResolver.resolve(intent);
    const second = ViewResolver.resolve(intent);
    expect(first).toBe(second);
    expect(listSubtreeEntitiesAction).toHaveBeenCalledTimes(1);

    resolveRequest?.({
      items: [],
      hasMore: false,
      nextCursor: undefined,
      prevCursor: undefined,
    });
    await first;
  });

  it('Phase A: GC should evict view if windowed lease is expired', async () => {
    GlobalPolicyRegistry.retain('view', viewKey, 'test-owner', 'windowed');
    
    // Simulate initial ingest
    IngestionLayer.ingestSubtreeList(
      viewKey,
      [{ id: '1', parentNodeId: 'test-node-1', entityTypeId: 'device', nodeName: 'N1', name: 'D1' }],
      false,
      undefined,
      'cursor-1',
      'resolve'
    );
    
    expect(GlobalViewStore.get(viewKey)).not.toBeNull();

    // Sweep with large TTL shouldn't evict (lease acquired just now)
    const res1 = CacheGarbageCollector.sweep(10000);
    expect(res1.evictedKeys).not.toContain(viewKey);
    expect(GlobalViewStore.get(viewKey)).not.toBeNull();

    // An active windowed consumer remains protected regardless of TTL.
    const res2 = CacheGarbageCollector.sweep(-1);
    expect(res2.evictedKeys).not.toContain(viewKey);

    GlobalPolicyRegistry.release('view', viewKey, 'test-owner');
    const res3 = CacheGarbageCollector.sweep(10000);
    expect(res3.evictedKeys).not.toContain(viewKey);

    const res4 = CacheGarbageCollector.sweep(-1);
    expect(res4.evictedKeys).toContain(viewKey);
    expect(GlobalViewStore.get(viewKey)).toBeNull();
  });

  it('Phase A: GC should NOT evict view if persistent lease is active', async () => {
    GlobalPolicyRegistry.retain('view', viewKey, 'test-owner', 'persistent');
    
    IngestionLayer.ingestSubtreeList(
      viewKey,
      [],
      false,
      undefined,
      'cursor-1',
      'resolve'
    );

    // Sweep with negative TTL, but since it's persistent, it should survive
    const res = CacheGarbageCollector.sweep(-1);
    expect(res.evictedKeys).not.toContain(viewKey);
    expect(GlobalViewStore.get(viewKey)).not.toBeNull();
  });

  it('Phase B: Trimming should limit chunks to maxWindowChunks and preserve cursors symmetrically', () => {
    const maxChunks = 3; // Use 3 for easy testing

    // Ingest initial (Chunk 1)
    IngestionLayer.ingestSubtreeList(
      viewKey,
      [{ id: 'i1', parentNodeId: 'test-node-1', entityTypeId: 'device', nodeName: 'N1', name: 'D1' }],
      true,
      undefined,
      'cursor-1',
      'resolve',
      undefined,
      maxChunks
    );

    // Extend forward (Chunk 2)
    IngestionLayer.ingestSubtreeList(
      viewKey,
      [{ id: 'i2', parentNodeId: 'test-node-1', entityTypeId: 'device', nodeName: 'N1', name: 'D2' }],
      true,
      'cursor-1',
      'cursor-2',
      'extend',
      'forward',
      maxChunks
    );

    // Extend forward (Chunk 3)
    IngestionLayer.ingestSubtreeList(
      viewKey,
      [{ id: 'i3', parentNodeId: 'test-node-1', entityTypeId: 'device', nodeName: 'N1', name: 'D3' }],
      true,
      'cursor-2',
      'cursor-3',
      'extend',
      'forward',
      maxChunks
    );

    let view = GlobalViewStore.get(viewKey);
    expect(view?.pages.length).toBe(3);
    // Prev cursor is undefined (from initial)
    expect(view?.pages[0].prevCursor).toBeUndefined();
    // Next cursor is cursor-3
    expect(view?.pages[2].nextCursor).toBe('cursor-3');

    // Extend forward (Chunk 4) -> Should trigger Head Trimming
    IngestionLayer.ingestSubtreeList(
      viewKey,
      [{ id: 'i4', parentNodeId: 'test-node-1', entityTypeId: 'device', nodeName: 'N1', name: 'D4' }],
      true,
      'cursor-3',
      'cursor-4',
      'extend',
      'forward',
      maxChunks
    );

    view = GlobalViewStore.get(viewKey);
    expect(view?.pages.length).toBe(3);
    
    // Chunk 1 was shifted out. The new top chunk is what used to be Chunk 2.
    // Chunk 2 was ingested via extend forward with requestCursor 'cursor-1' and newCursor 'cursor-2'
    // Since it was forward, prevCursor of Chunk 2 is the requestCursor ('cursor-1').
    expect(view?.pages[0].prevCursor).toBe('cursor-1');
    expect(view?.pages[2].nextCursor).toBe('cursor-4');

    // Now let's Extend backward (Prepend Chunk 0)
    IngestionLayer.ingestSubtreeList(
      viewKey,
      [{ id: 'i0', parentNodeId: 'test-node-1', entityTypeId: 'device', nodeName: 'N1', name: 'D0' }],
      true,
      'cursor-1',
      'cursor-0',
      'extend',
      'backward',
      maxChunks
    );

    view = GlobalViewStore.get(viewKey);
    expect(view?.pages.length).toBe(3);
    
    // Chunk 4 was popped out.
    // The new bottom chunk is Chunk 3. Chunk 3 was ingested with requestCursor 'cursor-2' and nextCursor 'cursor-3'.
    // Since it was forward extend, its nextCursor is 'cursor-3'.
    expect(view?.pages[2].nextCursor).toBe('cursor-3');
    
    // The new top chunk is Chunk 0. It was ingested backward, meaning newCursor is 'cursor-0', so prevCursor is 'cursor-0'.
    expect(view?.pages[0].prevCursor).toBe('cursor-0');
  });

  it('Phase C: Delete behavior - deleting an entity should remove it from EntityStore, making it ignored by UI hooks', () => {
    // Ingest a list of entities
    IngestionLayer.ingestSubtreeList(
      viewKey,
      [
        { id: 'e1', parentNodeId: 'test-node-1', entityTypeId: 'device', nodeName: 'N1', name: 'Device 1' },
        { id: 'e2', parentNodeId: 'test-node-1', entityTypeId: 'device', nodeName: 'N1', name: 'Device 2' }
      ],
      false,
      undefined,
      'cursor-1',
      'resolve'
    );

    const cacheClient = AppCache.getEntityCache('device');
    expect(cacheClient.get('e1')).not.toBeNull();
    expect(cacheClient.get('e2')).not.toBeNull();

    // Verify view has both descriptors
    let view = GlobalViewStore.get(viewKey);
    let flatItems = view!.pages.flatMap(p => p.items);
    expect(flatItems.length).toBe(2);

    // Simulate delete
    cacheClient.remove('e1');

    // Descriptors are unchanged...
    view = GlobalViewStore.get(viewKey);
    flatItems = view!.pages.flatMap(p => p.items);
    expect(flatItems.length).toBe(2);

    // ...but the Canonical Store is missing the entity
    expect(cacheClient.get('e1')).toBeNull();
    expect(cacheClient.get('e2')).not.toBeNull();
  });
});
