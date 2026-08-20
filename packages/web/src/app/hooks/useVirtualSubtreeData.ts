'use client';

import { useCallback, useMemo } from 'react';
import { useSemanticView } from './useSemanticView';
import { AppCache } from '../cache/GlobalCacheClient';
import { flattenViewPages, getViewHasMoreForward, getViewHasMoreBackward, getViewNextCursor, getViewPrevCursor } from '../cache/ViewStore';
import { RefObject } from 'react';
import { useAppCacheRevision } from './useAppCacheRevision';

export interface SubtreeEntityItem {
  id: string;
  parentNodeId: string;
  entityTypeId: string;
  name: string;
  description: string;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
  payload: Record<string, unknown>;
  lockUserId?: string;
  lockSessionId?: string;
  lockExpiresAt?: string;
  nodeName: string;
  nodePath: string;
  nodeDepth: number;
}

export interface SubtreeCursor {
  path: string;
  name: string;
  id: string;
}

export interface UseVirtualSubtreeDataOptions {
  baseNodeId: string;
  maxWindowItems?: number; // non più usato direttamente, gestito dal CacheService (maxWindowChunks)
  search?: string;
  entityTypeId?: string;
  filters?: { name?: string; description?: string; lockState?: 'locked' | 'unlocked' };
  captureAnchorRef?: RefObject<((direction: 'forward' | 'backward') => void) | null>;
}

export function useVirtualSubtreeData(options: UseVirtualSubtreeDataOptions) {
  const { 
    viewKey,
    viewState, 
    isLoadingMoreForward, 
    isLoadingMoreBackward, 
    loadMoreForward, 
    loadMoreBackward, 
    refresh, 
    retry, 
    lastFailedAction 
  } = useSemanticView({
    viewType: 'SUBTREE_LIST',
    baseNodeId: options.baseNodeId,
    search: options.search,
    entityTypeId: options.entityTypeId,
    filters: options.filters,
  }, false, 'windowed');


  const cacheRevision = useAppCacheRevision();

  const items = useMemo(() => {
    // The tick invalidates this projection when a normalized entity/node changes.
    void cacheRevision;
    const mapped: Array<SubtreeEntityItem & { nodeId: string }> = [];
    const flatItems = flattenViewPages(viewState);

    for (const desc of flatItems) {
      if (desc.type === 'row' && desc.reference.namespace.startsWith('entity:')) {
        const entityTypeId = desc.reference.namespace.slice('entity:'.length);
        const entity = AppCache.getEntityCache(entityTypeId).get(desc.reference.id);
        if (entity) {
          const node = AppCache.nodes.get(entity.parentNodeId);
          if (node) {
            mapped.push({
              id: entity.id,
              entityTypeId: entity.entityTypeId,
              parentNodeId: entity.parentNodeId,
              nodeId: node.id, 
              nodeName: node.name,
              nodePath: node.path,
              nodeDepth: node.depth,
              name: entity.name,
              description: entity.description,
              rowVersion: entity.rowVersion,
              createdAt: entity.createdAt ?? '',
              updatedAt: entity.updatedAt ?? '',
              payload: entity.payload,
              ...(() => {
                const lock = AppCache.getLockState('entity', entity.id);
                return lock.locked
                  ? {
                      lockUserId: lock.byUserId,
                      lockSessionId: lock.bySessionId,
                      lockExpiresAt: lock.expiresAt,
                    }
                  : {};
              })()
            });
          }
        }
      }
    }
    return mapped;
  }, [viewState, cacheRevision]);

  const handleLoadMoreForward = useCallback(() => {
    loadMoreForward(() => options.captureAnchorRef?.current?.('forward'));
  }, [loadMoreForward, options.captureAnchorRef]);

  const handleLoadMoreBackward = useCallback(() => {
    loadMoreBackward(() => options.captureAnchorRef?.current?.('backward'));
  }, [loadMoreBackward, options.captureAnchorRef]);

  const isLoading = viewState?.status === 'loading' && items.length === 0;
  const isError = viewState?.status === 'error';
  const nodeProjection = Array.from(
    new Set(items.map((item) => item.parentNodeId))
  ).flatMap((nodeId) => {
    const node = AppCache.nodes.get(nodeId);
    return node
      ? [{ id: node.id, name: node.name, rowVersion: node.rowVersion }]
      : [];
  });

  return {
    debugInfo: {
      viewKey,
      status: viewState?.status ?? 'idle',
      satisfactionStatus: viewState?.satisfactionStatus ?? 'missing-view',
      pageCount: viewState?.pages.length ?? 0,
      pageSizes: viewState?.pages.map((page) => page.items.length) ?? [],
      descriptorCount: flattenViewPages(viewState).length,
      visibleItemCount: items.length,
      cacheRevision,
      nodeProjection,
      recentNodeWrites: AppCache.nodes.getRecentWrites(),
      previousCursor: getViewPrevCursor(viewState),
      nextCursor: getViewNextCursor(viewState),
      updatedAt: viewState?.updatedAt ?? null,
      error: viewState?.error ?? null,
      lastFailedAction,
      diagnostics: viewState?.diagnostics ?? null,
    },
    items,
    isLoading,
    isLoadingMoreForward,
    isLoadingMoreBackward,
    hasMoreForward: getViewHasMoreForward(viewState),
    hasMoreBackward: getViewHasMoreBackward(viewState),
    canLoadMoreForward: !!getViewNextCursor(viewState),
    canLoadMoreBackward: !!getViewPrevCursor(viewState),
    error: viewState?.error,
    isError,
    lastFailedAction,
    loadMoreForward: handleLoadMoreForward,
    loadMoreBackward: handleLoadMoreBackward,
    refresh,
    retry,
  };
}
