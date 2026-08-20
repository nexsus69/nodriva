import { ViewKeyBuilder, SemanticViewKeyParams } from './SemanticViewKey';
import { 
  GlobalViewStore, 
  ViewState, 
  SatisfactionStatus, 
  ViewItemDescriptor, 
  ViewPage,
  flattenViewPages,
  getViewItemKey,
  getViewRowReferences,
  VIEW_DEPENDENCIES,
  getViewHasMoreForward,
  getViewHasMoreBackward,
  getViewNextCursor,
  getViewPrevCursor
} from './ViewStore';
import type { CacheRecordReference } from './ViewStore';
import { CacheEpochChangedError } from './CacheKernel';
import { AppCache } from './GlobalCacheClient';
import { INFINITE_LIST_CONFIG } from './InfiniteListConfig';
import { listSubtreeEntitiesAction } from '../actions/entityActions';
import type { ListSubtreeEntitiesParams } from '../actions/entityActions';
import type { ClientEntity, ClientNode, EntityTypeMeta, NodeTypeMeta } from '../types/models';

type SubtreeCursor = NonNullable<ListSubtreeEntitiesParams['cursor']>;
type SubtreeListItem = Partial<ClientEntity> & {
  id: string;
  entityTypeId: string;
  parentNodeId: string;
  nodeName: string;
  nodePath?: string;
  nodeDepth?: number;
  nodeRowVersion?: number;
  createdAt?: string;
  updatedAt?: string;
  lockUserId?: string;
  lockSessionId?: string;
  lockExpiresAt?: string;
};
type CachedEntityInput = Partial<ClientEntity> & {
  id: string;
  entityTypeId: string;
  parentNodeId: string;
};

function cursorsEqual(first: unknown, second: unknown): boolean {
  if (Object.is(first, second)) return true;
  if (
    typeof first !== 'object' ||
    first === null ||
    typeof second !== 'object' ||
    second === null
  ) {
    return false;
  }
  const a = first as Partial<SubtreeCursor>;
  const b = second as Partial<SubtreeCursor>;
  return a.path === b.path && a.name === b.name && a.id === b.id;
}

// -----------------------------------------------------------------------------
// 1. INTENT CONTRACT
// -----------------------------------------------------------------------------
export type ViewIntent = 
  | { type: 'resolve'; params: SemanticViewKeyParams; requireComplete: boolean }
  | { type: 'extend'; params: SemanticViewKeyParams; requireComplete: boolean; direction: 'forward' | 'backward'; pageSize?: number };

export interface SatisfactionResult {
  status: SatisfactionStatus;
  references: CacheRecordReference[];
}

// -----------------------------------------------------------------------------
// 2. SATISFIABILITY EVALUATOR (Pure)
// -----------------------------------------------------------------------------
export class SatisfiabilityEvaluator {
  static inspect(viewKey: string, requireComplete: boolean): SatisfactionResult {
    const view = GlobalViewStore.get(viewKey);
    if (!view) return { status: 'missing-view', references: [] };

    if (view.status === 'error') return { status: 'stale', references: [] };
    if (view.status === 'idle' || view.status === 'loading') {
      return { status: 'missing-view', references: [] };
    }

    const STALE_TTL = 5 * 60 * 1000;
    if (Date.now() - view.updatedAt > STALE_TTL) {
      return { status: 'stale', references: [] };
    }
    if (view.pages.length === 0) return { status: 'missing-view', references: [] };

    const flatItems = flattenViewPages(view);
    if (flatItems.length === 0) return { status: 'satisfied', references: [] };

    const missing = new Map<string, CacheRecordReference>();
    const incomplete = new Map<string, CacheRecordReference>();

    for (const item of flatItems) {
      if (item.type !== 'row') continue;
      const references = getViewRowReferences(item);
      for (const [index, reference] of references.entries()) {
        const requiredReference = requireComplete && index === 0
          ? { ...reference, completeness: 'full' as const }
          : reference;
        const satisfaction = AppCache.getReferenceSatisfaction(requiredReference);
        const referenceKey = `${requiredReference.namespace}:${requiredReference.id}:${requiredReference.completeness}`;
        if (satisfaction === 'missing') missing.set(referenceKey, requiredReference);
        if (satisfaction === 'incomplete' || satisfaction === 'stale') {
          incomplete.set(referenceKey, requiredReference);
        }
      }
    }

    if (missing.size > 0) return { status: 'missing-records', references: [...missing.values()] };
    if (incomplete.size > 0) return { status: 'partial', references: [...incomplete.values()] };
    return { status: 'satisfied', references: [] };
  }

  static evaluate(viewKey: string, requireComplete: boolean): SatisfactionStatus {
    return this.inspect(viewKey, requireComplete).status;
  }
}

export class RecordHydrator {
  private static readonly pending = new Map<string, Promise<boolean>>();

  static async hydrate(references: readonly CacheRecordReference[]): Promise<boolean> {
    const results = await Promise.all(references.map((reference) => {
      const key = `${AppCache.getCacheEpoch()}:${reference.namespace}:${reference.id}:${reference.completeness}`;
      const existing = this.pending.get(key);
      if (existing) return existing;
      const request = AppCache.hydrateReference(reference).finally(() => {
        if (this.pending.get(key) === request) this.pending.delete(key);
      });
      this.pending.set(key, request);
      return request;
    }));
    return results.every(Boolean);
  }
}

// -----------------------------------------------------------------------------
// 3. INGESTION LAYER
// -----------------------------------------------------------------------------
export class IngestionLayer {
  static ingestSubtreeList(
    viewKey: string, 
    items: SubtreeListItem[],
    hasMore: boolean, 
    requestCursor: unknown,
    newCursor: unknown,
    intentType: 'resolve' | 'extend',
    direction?: 'forward' | 'backward',
    maxWindowChunks: number = INFINITE_LIST_CONFIG.maxWindowPages
  ) {
    const newDescriptors: ViewItemDescriptor[] = [];

    // 1. Ingest EntityStore
    items.forEach(item => {
      AppCache.setLockState('entity', item.id, item.lockUserId
        ? {
            locked: true,
            byUserId: item.lockUserId,
            bySessionId: item.lockSessionId,
            expiresAt: item.lockExpiresAt,
          }
        : { locked: false });
      AppCache.nodes.inject(item.parentNodeId, {
        id: item.parentNodeId,
        name: item.nodeName,
        path: item.nodePath,
        depth: item.nodeDepth,
        rowVersion: item.nodeRowVersion,
      }, true, 'view:subtree');

      AppCache.getEntityCache(item.entityTypeId).inject(item.id, {
        id: item.id,
        entityTypeId: item.entityTypeId,
        parentNodeId: item.parentNodeId,
        name: item.name,
        description: item.description,
        rowVersion: item.rowVersion,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        payload: item.payload,
      }, true);

      newDescriptors.push({
        type: 'row',
        reference: {
          namespace: `entity:${item.entityTypeId}`,
          id: item.id,
          completeness: 'summary',
        },
        requires: [{
          namespace: 'node',
          id: item.parentNodeId,
          completeness: 'summary',
        }],
      });
    });

    const existingView = GlobalViewStore.get(viewKey);
    let updatedPages: ViewPage[] = existingView ? [...existingView.pages] : [];
    const diagnostics = existingView?.diagnostics ?? {
      forwardExtensions: 0,
      backwardExtensions: 0,
      trimmedHeadPages: 0,
      trimmedTailPages: 0,
      lastIntent: 'resolve' as const,
    };
    let trimmedHeadPages = 0;
    let trimmedTailPages = 0;

    // A resolve replaces the current window, so it must not deduplicate against
    // the view it is replacing. An extend must instead reject cross-page overlap.
    const seenKeys = new Set<string>(
      intentType === 'extend'
        ? flattenViewPages(existingView).map(getViewItemKey)
        : []
    );
    const filteredNew = newDescriptors.filter((descriptor) => {
      const key = getViewItemKey(descriptor);
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });

    let finalPrevCursor: unknown;
    let finalNextCursor: unknown;
    let finalHasMoreForward: boolean;
    let finalHasMoreBackward: boolean;

    if (intentType === 'resolve') {
      finalPrevCursor = requestCursor;
      finalNextCursor = newCursor;
      finalHasMoreForward = hasMore;
      finalHasMoreBackward = false;
    } else if (direction === 'forward') {
      finalPrevCursor = requestCursor;
      finalNextCursor = newCursor;
      finalHasMoreForward = hasMore;
      finalHasMoreBackward = existingView ? getViewHasMoreBackward(existingView) : false;
    } else {
      finalPrevCursor = newCursor;
      finalNextCursor = requestCursor;
      finalHasMoreForward = existingView ? getViewHasMoreForward(existingView) : false;
      finalHasMoreBackward = hasMore;
    }

    // A non-advancing cursor would make an intersection sentinel request the
    // same page forever. Treat it as a terminal boundary.
    if (
      intentType === 'extend' &&
      filteredNew.length === 0 &&
      cursorsEqual(requestCursor, newCursor)
    ) {
      if (direction === 'forward') finalHasMoreForward = false;
      else finalHasMoreBackward = false;
    }

    const firstItem = items[0];
    const lastItem = items[items.length - 1];
    const pagePrevCursor =
      firstItem?.nodePath && firstItem.name
        ? { path: firstItem.nodePath, name: firstItem.name, id: firstItem.id }
        : finalPrevCursor;
    const pageNextCursor =
      lastItem?.nodePath && lastItem.name
        ? { path: lastItem.nodePath, name: lastItem.name, id: lastItem.id }
        : finalNextCursor;

    const newPage: ViewPage = {
      items: filteredNew,
      // Cursors belong to this page, not to the request boundary. This is
      // essential when the adjacent page is trimmed and later reloaded.
      prevCursor: pagePrevCursor,
      nextCursor: pageNextCursor,
      hasMoreForward: finalHasMoreForward,
      hasMoreBackward: finalHasMoreBackward,
    };

    if (intentType === 'extend') {
      if (direction === 'forward') {
        // Fix up cursors of the newly appended page so it inherits hasMoreBackward of the view
        newPage.hasMoreBackward = getViewHasMoreBackward(existingView);
        // Note: prevCursor of the new page is theoretically the boundary, but realistically we only care about 
        // pages[0].prevCursor and pages[last].nextCursor globally.
        updatedPages.push(newPage);
        
        // Window Trimming (Head)
        let evicted = false;
        while (updatedPages.length > maxWindowChunks && updatedPages.length > 1) {
          updatedPages.shift(); // Evict from the top
          evicted = true;
          trimmedHeadPages += 1;
        }
        if (evicted && updatedPages.length > 0) {
          updatedPages[0].hasMoreBackward = true;
        }
      } else if (direction === 'backward') {
        newPage.hasMoreForward = getViewHasMoreForward(existingView);
        updatedPages.unshift(newPage);
        
        // Window Trimming (Tail)
        let evicted = false;
        while (updatedPages.length > maxWindowChunks && updatedPages.length > 1) {
          updatedPages.pop(); // Evict from the bottom
          evicted = true;
          trimmedTailPages += 1;
        }
        if (evicted && updatedPages.length > 0) {
          updatedPages[updatedPages.length - 1].hasMoreForward = true;
        }
      }
    } else {
      updatedPages = [newPage];
    }

    GlobalViewStore.set(viewKey, {
      viewKey,
      pages: updatedPages,
      status: 'success',
      error: null,
      satisfactionStatus: 'satisfied', 
      updatedAt: Date.now(),
      dependencyTokens: [VIEW_DEPENDENCIES.entityMembership, VIEW_DEPENDENCIES.nodeHierarchy],
      diagnostics: {
        forwardExtensions:
          diagnostics.forwardExtensions +
          (intentType === 'extend' && direction === 'forward' ? 1 : 0),
        backwardExtensions:
          diagnostics.backwardExtensions +
          (intentType === 'extend' && direction === 'backward' ? 1 : 0),
        trimmedHeadPages: diagnostics.trimmedHeadPages + trimmedHeadPages,
        trimmedTailPages: diagnostics.trimmedTailPages + trimmedTailPages,
        lastIntent:
          intentType === 'resolve'
            ? 'resolve'
            : direction === 'backward'
              ? 'backward'
              : 'forward',
      },
    });
  }

  static ingestEntityDetail(viewKey: string, entity: CachedEntityInput) {
    AppCache.getEntityCache(entity.entityTypeId).inject(entity.id, {
      id: entity.id,
      entityTypeId: entity.entityTypeId,
      parentNodeId: entity.parentNodeId,
      name: entity.name,
      description: entity.description,
      rowVersion: entity.rowVersion,
      payload: entity.payload,
    }, false); // inject as complete

    const newPage: ViewPage = {
      items: [{
        type: 'row',
        reference: {
          namespace: `entity:${entity.entityTypeId}`,
          id: entity.id,
          completeness: 'full',
        },
      }],
      prevCursor: null,
      nextCursor: null,
      hasMoreForward: false,
      hasMoreBackward: false,
    };

    GlobalViewStore.set(viewKey, {
      viewKey,
      pages: [newPage],
      status: 'success',
      error: null,
      satisfactionStatus: 'satisfied',
      updatedAt: Date.now(),
    });
  }

  static ingestNodeChildrenList(viewKey: string, items: ClientNode[]) {
    const newDescriptors: ViewItemDescriptor[] = [];
    
    items.forEach(node => {
      AppCache.nodes.inject(node.id, node, false, 'view:children');
      
      newDescriptors.push({
        type: 'row',
        reference: { namespace: 'node', id: node.id, completeness: 'full' },
      });
    });

    const newPage: ViewPage = {
      items: newDescriptors,
      prevCursor: null,
      nextCursor: null,
      hasMoreForward: false,
      hasMoreBackward: false,
    };

    GlobalViewStore.set(viewKey, {
      viewKey,
      pages: [newPage],
      status: 'success',
      error: null,
      satisfactionStatus: 'satisfied',
      updatedAt: Date.now(),
      dependencyTokens: [VIEW_DEPENDENCIES.nodeChildren],
    });
  }

  static ingestBreadcrumb(viewKey: string, nodes: ClientNode[]) {
    nodes.forEach((node) => AppCache.nodes.inject(node.id, node, false, 'view:breadcrumb'));
    GlobalViewStore.set(viewKey, {
      viewKey,
      pages: [{
        items: nodes.map((node) => ({
          type: 'row' as const,
          reference: { namespace: 'node' as const, id: node.id, completeness: 'full' as const },
        })),
        prevCursor: null,
        nextCursor: null,
        hasMoreForward: false,
        hasMoreBackward: false,
      }],
      status: 'success',
      error: null,
      satisfactionStatus: 'satisfied',
      updatedAt: Date.now(),
      dependencyTokens: [VIEW_DEPENDENCIES.nodeHierarchy],
    });
  }

  static ingestNodeEntityCollection(viewKey: string, items: CachedEntityInput[]) {
    const newDescriptors: ViewItemDescriptor[] = [];
    
    items.forEach(item => {
      AppCache.getEntityCache(item.entityTypeId).inject(item.id, {
        id: item.id,
        entityTypeId: item.entityTypeId,
        parentNodeId: item.parentNodeId,
        name: item.name,
        description: item.description,
        rowVersion: item.rowVersion,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        payload: item.payload,
      }, false);

      newDescriptors.push({
        type: 'row',
        reference: {
          namespace: `entity:${item.entityTypeId}`,
          id: item.id,
          completeness: 'full',
        },
      });
    });

    const newPage: ViewPage = {
      items: newDescriptors,
      prevCursor: null,
      nextCursor: null,
      hasMoreForward: false,
      hasMoreBackward: false,
    };

    GlobalViewStore.set(viewKey, {
      viewKey,
      pages: [newPage],
      status: 'success',
      error: null,
      satisfactionStatus: 'satisfied',
      updatedAt: Date.now(),
      dependencyTokens: [VIEW_DEPENDENCIES.entityMembership],
    });
  }

  static ingestMetadataList(
    viewKey: string,
    items: Array<NodeTypeMeta | EntityTypeMeta>,
    metadataType: 'node' | 'entity'
  ) {
    const newDescriptors: ViewItemDescriptor[] = [];
    
    items.forEach(item => {
      if (metadataType === 'node') {
        AppCache.nodeTypes.inject(item.id, {
          id: item.id,
          typeKey: item.typeKey,
          name: item.name,
          description: item.description,
          currentSchemaVersion: item.currentSchemaVersion,
        }, false);
      } else {
        if (!('storageTable' in item)) return;
        AppCache.entityTypes.inject(item.id, item, false);
      }
      newDescriptors.push({
        type: 'row',
        reference: {
          namespace: metadataType === 'node' ? 'node-type' : 'entity-type',
          id: item.id,
          completeness: 'full',
        },
      });
    });

    const newPage: ViewPage = {
      items: newDescriptors,
      prevCursor: null,
      nextCursor: null,
      hasMoreForward: false,
      hasMoreBackward: false,
    };

    GlobalViewStore.set(viewKey, {
      viewKey,
      pages: [newPage],
      status: 'success',
      error: null,
      satisfactionStatus: 'satisfied',
      updatedAt: Date.now(),
      dependencyTokens: [
        metadataType === 'node'
          ? VIEW_DEPENDENCIES.nodeMetadata
          : VIEW_DEPENDENCIES.entityMetadata,
      ],
    });
  }
}

// -----------------------------------------------------------------------------
// 4. FETCH COORDINATOR
// -----------------------------------------------------------------------------
export class FetchCoordinator {
  static recordError(viewKey: string, error: unknown): void {
    AppCache.handleFetchError(error);
    const failedView = GlobalViewStore.get(viewKey);
    if (!failedView) return;
    const errorCode =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string'
        ? error.code
        : 'FETCH_ERROR';
    const errorMessage = error instanceof Error ? error.message : String(error);
    GlobalViewStore.set(viewKey, {
      ...failedView,
      status: 'error',
      error: { code: errorCode, message: errorMessage, timestamp: Date.now() },
    });
  }

  static async executeFetch(intent: ViewIntent, viewKey: string) {
    const existingView = GlobalViewStore.get(viewKey);
    const requestEpoch = AppCache.getCacheEpoch();
    const assertCurrentEpoch = () => {
      if (AppCache.getCacheEpoch() !== requestEpoch) throw new CacheEpochChangedError();
    };
    
    // Solo per il resolve iniziale (o se non c'è view): segnala 'loading' al ViewStore.
    // Per gli extend NON tocchiamo il ViewStore prima del fetch: evita notifiche spurie
    // che interferiscono con il ciclo sentinella e i guard in useSemanticView.
    if (intent.type === 'resolve' || !existingView) {
      GlobalViewStore.set(viewKey, {
        ...(existingView || { 
            viewKey, pages: [], satisfactionStatus: 'missing-view', 
            updatedAt: Date.now() 
        }),
        status: 'loading',
        error: null
      });
    }

    try {
      if (intent.params.viewType === 'SUBTREE_LIST') {
        const direction = intent.type === 'extend' ? intent.direction : 'forward'; 
        const cursor = intent.type === 'extend' 
          ? (direction === 'forward' ? getViewNextCursor(existingView) : getViewPrevCursor(existingView)) 
          : undefined;
        
        const limit = intent.type === 'extend'
          ? (intent.pageSize || INFINITE_LIST_CONFIG.pageSize)
          : INFINITE_LIST_CONFIG.pageSize;

        const res = await listSubtreeEntitiesAction({
          baseNodeId: intent.params.baseNodeId!,
          limit,
          direction,
          cursor: cursor as SubtreeCursor | undefined,
          search: intent.params.search,
          entityTypeId: intent.params.entityTypeId,
          filters: intent.params.filters as { name?: string; description?: string; lockState?: 'locked' | 'unlocked' } | undefined,
        });
        assertCurrentEpoch();

        const newCursor = direction === 'backward' ? res.prevCursor : res.nextCursor;

        IngestionLayer.ingestSubtreeList(
          viewKey, 
          res.items, 
          res.hasMore, 
          cursor,
          newCursor, 
          intent.type,
          intent.type === 'extend' ? direction : undefined
        );
      } else if (intent.params.viewType === 'ENTITY_DETAIL') {
        const { getEntityByIdAction } = await import('../actions/entityActions');
        const res = await getEntityByIdAction(intent.params.entityId!);
        assertCurrentEpoch();
        if (!res) throw new Error(`Entity ${intent.params.entityId} not found`);
        IngestionLayer.ingestEntityDetail(viewKey, res);
      } else if (intent.params.viewType === 'BREADCRUMB') {
        const { getNodeBreadcrumbAction } = await import('../actions/nodeActions');
        const res = await getNodeBreadcrumbAction(intent.params.baseNodeId!);
        assertCurrentEpoch();
        IngestionLayer.ingestBreadcrumb(viewKey, res);
      } else if (intent.params.viewType === 'NODE_CHILDREN_LIST') {
        const { listChildrenAction } = await import('../actions/nodeActions');
        const res = await listChildrenAction(intent.params.baseNodeId || null);
        assertCurrentEpoch();
        IngestionLayer.ingestNodeChildrenList(viewKey, res);
      } else if (intent.params.viewType === 'NODE_ENTITY_COLLECTION') {
        const { listEntitiesAction } = await import('../actions/entityActions');
        const res = await listEntitiesAction(intent.params.baseNodeId!);
        assertCurrentEpoch();
        IngestionLayer.ingestNodeEntityCollection(viewKey, res);
      } else if (intent.params.viewType === 'METADATA_LIST') {
        if (intent.params.metadataType === 'node') {
          const { listNodeTypesAction } = await import('../actions/nodeActions');
          const res = await listNodeTypesAction();
          assertCurrentEpoch();
          IngestionLayer.ingestMetadataList(viewKey, res, 'node');
        } else {
          const { listEntityTypesAction } = await import('../actions/entityActions');
          const res = await listEntityTypesAction();
          assertCurrentEpoch();
          IngestionLayer.ingestMetadataList(viewKey, res, 'entity');
        }
      } else {
        throw new Error(`ViewType ${intent.params.viewType} not supported yet.`);
      }
    } catch (error: unknown) {
      if (error instanceof CacheEpochChangedError) throw error;
      this.recordError(viewKey, error);
      throw error;
    }
  }
}

// -----------------------------------------------------------------------------
// 5. VIEW RESOLVER (Entry Point API)
// -----------------------------------------------------------------------------
export class ViewResolver {
  private static readonly pendingResolutions = new Map<string, Promise<ViewState | null>>();

  static resolve(intent: ViewIntent): Promise<ViewState | null> {
    const viewKey = ViewKeyBuilder.build(intent.params);
    const requestKey = `${AppCache.getCacheEpoch()}|${viewKey}|${intent.type}|${intent.type === 'extend' ? intent.direction : 'initial'}`;
    const pending = this.pendingResolutions.get(requestKey);
    if (pending) return pending;

    const resolution = this.executeResolve(intent, viewKey).finally(() => {
      if (this.pendingResolutions.get(requestKey) === resolution) {
        this.pendingResolutions.delete(requestKey);
      }
    });
    this.pendingResolutions.set(requestKey, resolution);
    return resolution;
  }

  private static async executeResolve(intent: ViewIntent, viewKey: string): Promise<ViewState | null> {
    let inspection = SatisfiabilityEvaluator.inspect(viewKey, intent.requireComplete);
    const inspectedView = GlobalViewStore.get(viewKey);
    if (inspectedView && inspectedView.satisfactionStatus !== inspection.status) {
      GlobalViewStore.set(viewKey, {
        ...inspectedView,
        satisfactionStatus: inspection.status,
      });
    }

    if (intent.type === 'extend' || inspection.status === 'missing-view' || inspection.status === 'stale') {
      await FetchCoordinator.executeFetch(intent, viewKey);
    } else if (inspection.status === 'missing-records' || inspection.status === 'partial') {
      try {
        const hydrated = await RecordHydrator.hydrate(inspection.references);
        inspection = SatisfiabilityEvaluator.inspect(viewKey, intent.requireComplete);
        if (!hydrated || inspection.status !== 'satisfied') {
          await FetchCoordinator.executeFetch(intent, viewKey);
        }
      } catch (error: unknown) {
        FetchCoordinator.recordError(viewKey, error);
        throw error;
      }
    }

    const satisfaction = SatisfiabilityEvaluator.evaluate(viewKey, intent.requireComplete);
    const finalView = GlobalViewStore.get(viewKey);

    if (finalView && finalView.satisfactionStatus !== satisfaction) {
        GlobalViewStore.set(viewKey, {
            ...finalView,
            satisfactionStatus: satisfaction
        });
    }

    return GlobalViewStore.get(viewKey);
  }
}
