'use client';

import { useAppCacheRevision } from './useAppCacheRevision';
import { useSemanticView } from './useSemanticView';
import { AppCache } from '../cache/GlobalCacheClient';
import { flattenViewPages } from '../cache/ViewStore';
import type { ClientNode } from '../types/models';

export function useSemanticNodeBreadcrumb(nodeId: string) {
  const { viewState, retry } = useSemanticView(
    { viewType: 'BREADCRUMB', baseNodeId: nodeId },
    true,
    'persistent',
  );
  const cacheRevision = useAppCacheRevision();
  void cacheRevision;

  const nodes = flattenViewPages(viewState)
    .filter((item): item is typeof item & { type: 'row' } => item.type === 'row')
    .map((item) => AppCache.nodes.get(item.id))
    .filter((node): node is ClientNode => node !== null);

  return {
    nodes,
    isLoading: !viewState || viewState.status === 'idle' || viewState.status === 'loading',
    error: viewState?.status === 'error' ? viewState.error : null,
    retry,
  };
}
