import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
vi.mock('./db', () => ({
  db: {},
  executor: {},
  transaction: vi.fn(),
}));

vi.mock('../app/actions/nodeActions', () => ({
  createNodeAction: vi.fn(),
  updateNodeAction: vi.fn(),
  moveNodeAction: vi.fn(),
  listChildrenAction: vi.fn(),
  listNodeTypesAction: vi.fn(),
}));

vi.mock('../app/actions/entityActions', () => ({
  listEntitiesAction: vi.fn(),
  listEntityTypesAction: vi.fn(),
}));

import fs from 'fs';
import path from 'path';
import { GlobalViewStore } from '../app/cache/ViewStore';
import { AppCache, CreateNodeInput, UpdateNodeInput, MoveNodeInput } from '../app/cache/GlobalCacheClient';
import { GlobalPolicyRegistry } from '../app/cache/PolicyRegistry';
import { CacheGarbageCollectorService } from '../app/cache/CacheGarbageCollector';
import { ViewKeyBuilder } from '../app/cache/SemanticViewKey';
import { ViewResolver } from '../app/cache/CacheService';
import * as nodeActions from '../app/actions/nodeActions';
import * as entityActions from '../app/actions/entityActions';

describe('Architecture Compliance - Phase 1', () => {
  let gc: CacheGarbageCollectorService;

  beforeEach(() => {
    // Reset singleton state
    GlobalViewStore['views'].clear();
    GlobalPolicyRegistry['leases'] = [];
    
    // We create a fresh GC instance for testing to avoid timer side effects
    gc = new CacheGarbageCollectorService();
    vi.useFakeTimers();
    vi.mocked(entityActions.listEntityTypesAction).mockResolvedValue([
      { id: 'test-type', typeKey: 'test_type', name: 'Test type', description: '', storageTable: 'entity_test_type', currentSchemaVersion: 1 },
    ] as never);
  });

  afterEach(() => {
    gc.stop();
    vi.restoreAllMocks();
  });

  describe('Garbage Collector Lifecycle', () => {
    it('should start and run sweep on interval', () => {
      const sweepSpy = vi.spyOn(gc, 'sweep');
      
      gc.start(30000, 5000);
      expect(sweepSpy).not.toHaveBeenCalled();
      
      vi.advanceTimersByTime(30000);
      expect(sweepSpy).toHaveBeenCalledTimes(1);
      
      vi.advanceTimersByTime(30000);
      expect(sweepSpy).toHaveBeenCalledTimes(2);
    });

    it('should evict expired windowed views from ViewStore', () => {
      const viewKey = 'test_view';
    GlobalViewStore.set(viewKey, {
        viewKey,
        status: 'success',
        pages: [],
        updatedAt: Date.now(),
        error: null,
        satisfactionStatus: 'satisfied',
      });

      // Retain the view with a windowed lease
      const ownerId = 'test_owner';
      GlobalPolicyRegistry.retain('view', viewKey, ownerId, 'windowed');
      GlobalPolicyRegistry.release('view', viewKey, ownerId);

      // Set release time to 10 seconds ago (expired given 5s TTL)
      GlobalPolicyRegistry['leases'][0].releasedAt = Date.now() - 10000;

      const result = gc.sweep(5000);
      
      expect(result.evictedKeys).toContain(viewKey);
      expect(GlobalViewStore.get(viewKey)).toBeNull();
    });

    it('should NOT evict entities from EntityStore when view is evicted', () => {
      const viewKey = 'test_view';
      GlobalViewStore.set(viewKey, {
        viewKey,
        status: 'success',
        pages: [],
        updatedAt: Date.now(),
        error: null,
        satisfactionStatus: 'satisfied',
      });

      // Insert an entity into the canonical store
      const entityTypeId = 'test_type';
      const entityId = 'entity_1';
      AppCache.getEntityCache(entityTypeId).inject(entityId, { id: entityId, name: 'test' } as unknown as never);

      // Force eviction of the view
      gc.sweep(5000); // 0 leases, so it evicts immediately

      // View is gone
      expect(GlobalViewStore.get(viewKey)).toBeNull();

      // But entity is STILL in EntityStore (Architecture rule: GC view vs entity lifetime)
      const entity = AppCache.getEntityCache(entityTypeId).get(entityId);
      expect(entity).toBeDefined();
      expect(entity?.id).toBe(entityId);
    });
  });

  describe('Delete Flow & View Invalidation', () => {
    it('should allow deletion of view from ViewStore upon entity delete intent', () => {
      const parentNodeId = 'node_1';
      const listKey = ViewKeyBuilder.build({ viewType: 'SUBTREE_LIST', baseNodeId: parentNodeId });
      
      GlobalViewStore.set(listKey, {
        viewKey: listKey,
        status: 'success',
        pages: [],
        updatedAt: Date.now(),
        error: null,
        satisfactionStatus: 'satisfied',
      });

      expect(GlobalViewStore.get(listKey)).toBeDefined();

      // Simulate what the UI delete handler does now
      GlobalViewStore.delete(listKey);

      expect(GlobalViewStore.get(listKey)).toBeNull();
    });
  });

  describe('Node Mutations', () => {
    it('should inject new node into domain cache upon createNode', async () => {
      // Mock node action return value since we mock db
      // Actually we just test the AppCache orchestrator behavior
      vi.mocked(nodeActions.createNodeAction).mockResolvedValue({ id: 'node_new', name: 'Test Node', parentId: 'root' } as unknown as never);

      const input: CreateNodeInput = { parentNodeId: 'root', nodeTypeKey: 'test', name: 'Test Node' };
      const result = await AppCache.createNode(input);
      
      expect(result.id).toBe('node_new');
      expect(AppCache.nodes.get('node_new')).toEqual({ id: 'node_new', name: 'Test Node', parentId: 'root' });
    });

    it('should inject updated node into domain cache upon updateNode', async () => {
      vi.mocked(nodeActions.updateNodeAction).mockResolvedValue({ id: 'node_1', name: 'Updated Node', expectedRowVersion: 2 } as unknown as never);

      const input: UpdateNodeInput = { nodeId: 'node_1', name: 'Updated Node', expectedRowVersion: 1 };
      const result = await AppCache.updateNode(input);
      
      expect(result.name).toBe('Updated Node');
      expect(AppCache.nodes.get('node_1')).toBeDefined();
      expect(AppCache.nodes.get('node_1')?.name).toBe('Updated Node');
    });

    it('should inject moved node into domain cache upon moveNode', async () => {
      vi.mocked(nodeActions.moveNodeAction).mockResolvedValue({ id: 'node_1', name: 'Moved Node', parentId: 'new_parent' } as unknown as never);

      const input: MoveNodeInput = { nodeId: 'node_1', newParentNodeId: 'new_parent', expectedNodeRowVersion: 2 };
      const result = await AppCache.moveNode(input);
      
      expect(result?.parentId).toBe('new_parent');
      expect(AppCache.nodes.get('node_1')?.parentId).toBe('new_parent');
    });
  });

  describe('Phase 2.5 Views (NODE_CHILDREN_LIST, NODE_ENTITY_COLLECTION, METADATA_LIST)', () => {
    it('should successfully ingest NODE_CHILDREN_LIST and create a single flat page', async () => {
      const mockNodes = [{ id: 'child_1', name: 'Child 1', parentId: 'root' }];
      vi.mocked(nodeActions.listChildrenAction).mockResolvedValue(mockNodes as unknown as never);

      const intent = { type: 'resolve', params: { viewType: 'NODE_CHILDREN_LIST', baseNodeId: 'root' }, requireComplete: true } as const;
      
      const view = await ViewResolver.resolve(intent);
      
      expect(view?.satisfactionStatus).toBe('satisfied');
      expect(view?.pages.length).toBe(1);
      expect(view?.pages[0].items[0]).toMatchObject({
        type: 'row',
        reference: { namespace: 'node', id: 'child_1', completeness: 'full' },
      });
      expect(AppCache.nodes.get('child_1')).toBeDefined();
    });

    it('should successfully ingest NODE_ENTITY_COLLECTION and create a single flat page', async () => {
      const mockEntities = [{ id: 'ent_1', name: 'Ent 1', parentNodeId: 'node_1', entityTypeId: 'test-type' }];
      vi.mocked(entityActions.listEntitiesAction).mockResolvedValue(mockEntities as unknown as never);
      AppCache.metadata.inject('entity', { id: 'test-type', typeKey: 'test_type', name: 'Test type', description: '', storageTable: 'entity_test_type', currentSchemaVersion: 1 });

      const intent = { type: 'resolve', params: { viewType: 'NODE_ENTITY_COLLECTION', baseNodeId: 'node_1' }, requireComplete: true } as const;
      
      const view = await ViewResolver.resolve(intent);
      
      expect(view?.satisfactionStatus).toBe('satisfied');
      expect(view?.pages.length).toBe(1);
      expect(view?.pages[0].items[0]).toMatchObject({
        type: 'row',
        reference: { namespace: 'entity:test-type', id: 'ent_1', completeness: 'full' },
      });
      expect(AppCache.getEntityCache('test-type').get('ent_1')).toBeDefined();
    });

    it('should successfully ingest METADATA_LIST', async () => {
      const mockTypes = [{ id: 'type_1', typeKey: 'type_1', name: 'Type 1' }];
      vi.mocked(nodeActions.listNodeTypesAction).mockResolvedValue(mockTypes as unknown as never);

      const intent = { type: 'resolve', params: { viewType: 'METADATA_LIST', metadataType: 'node' }, requireComplete: true } as const;
      
      const view = await ViewResolver.resolve(intent);
      
      expect(view?.satisfactionStatus).toBe('satisfied');
      expect(view?.pages.length).toBe(1);
      expect(AppCache.metadata.get('node', 'type_1')).toBeDefined();
    });
  });

  describe('Phase 3 Compliance (Static Analysis)', () => {
    it('does not retain the removed parallel DomainCacheClient implementation', () => {
      const cacheRoot = path.join(__dirname, '../app/cache');
      expect(fs.existsSync(path.join(cacheRoot, 'DomainCacheClient.ts'))).toBe(false);
      const sourceFiles = fs.readdirSync(cacheRoot).filter((file) => file.endsWith('.ts'));
      for (const file of sourceFiles) {
        const content = fs.readFileSync(path.join(cacheRoot, file), 'utf8');
        expect(content).not.toContain('DomainCacheClient');
      }
    });

    it('should confirm ReadModelContext.tsx no longer exists', () => {
      const contextPath = path.join(__dirname, '../app/context/ReadModelContext.tsx');
      expect(fs.existsSync(contextPath)).toBe(false);
    });

    it('should verify page.tsx and node detail page do not import ReadModelContext', () => {
      const pagePath = path.join(__dirname, '../app/page.tsx');
      const nodePagePath = path.join(__dirname, '../app/nodes/[nodeId]/page.tsx');

      const pageContent = fs.readFileSync(pagePath, 'utf8');
      const nodePageContent = fs.readFileSync(nodePagePath, 'utf8');

      expect(pageContent).not.toContain('ReadModelContext');
      expect(pageContent).not.toContain('useReadModel');
      expect(nodePageContent).not.toContain('ReadModelContext');
      expect(nodePageContent).not.toContain('useReadModel');
    });

    it('keeps route files as composition boundaries', () => {
      const appDirectory = path.join(__dirname, '../app');
      const routeFiles: string[] = [];
      const visit = (directory: string): void => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
          const entryPath = path.join(directory, entry.name);
          if (entry.isDirectory()) visit(entryPath);
          else if (entry.name === 'page.tsx' || entry.name === 'layout.tsx') routeFiles.push(entryPath);
        }
      };
      visit(appDirectory);

      for (const routeFile of routeFiles) {
        const source = fs.readFileSync(routeFile, 'utf8');
        expect(source.split('\n').length, path.relative(appDirectory, routeFile)).toBeLessThanOrEqual(60);
        expect(source, path.relative(appDirectory, routeFile)).not.toMatch(/\buse(?:State|Effect|Reducer|Transition)\b/);
      }
    });
  });
});
