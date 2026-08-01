import { useMemo } from 'react';
import { useSemanticView } from './useSemanticView';
import { AppCache } from '../cache/GlobalCacheClient';
import { ClientNode } from '../types/models';
import { useAppCacheRevision } from './useAppCacheRevision';
import type { RetentionClass } from '../cache/PolicyRegistry';

export function useSemanticNodeList(
  parentId: string | null,
  options?: { retentionClass?: RetentionClass }
) {
  const { viewState, refresh } = useSemanticView(
    { viewType: 'NODE_CHILDREN_LIST', baseNodeId: parentId || undefined },
    true, // We want all children completely loaded
    options?.retentionClass
  );
  
  const isLoading = !viewState || viewState.status === 'loading';
  const cacheRevision = useAppCacheRevision();

  const nodeIds = useMemo(() => {
    if (!viewState || !viewState.pages || viewState.pages.length === 0) return [];
    // NODE_CHILDREN_LIST is a single-page view
    const page = viewState.pages[0];
    return page.items
      .filter((item) => item.type === 'row')
      .map((item) => item.id);
  }, [viewState]);

  void cacheRevision;
  const nodes = nodeIds
    .map((id) => AppCache.nodes.get(id))
    .filter(Boolean) as ClientNode[];

  return {
    nodes,
    isLoading,
    error: viewState?.error || null,
    refresh,
  };
}
