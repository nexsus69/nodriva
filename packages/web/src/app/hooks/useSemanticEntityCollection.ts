import { useMemo } from 'react';
import { useSemanticView } from './useSemanticView';
import { AppCache } from '../cache/GlobalCacheClient';
import { ClientEntity } from '../types/models';
import { useAppCacheRevision } from './useAppCacheRevision';

export function useSemanticEntityCollection(nodeId: string) {
  const { viewState } = useSemanticView(
    { viewType: 'NODE_ENTITY_COLLECTION', baseNodeId: nodeId },
    true, // We want the full flat collection
    'windowed'
  );
  
  const isLoading = !viewState || viewState.status === 'loading' || viewState.satisfactionStatus !== 'satisfied';
  const cacheRevision = useAppCacheRevision();

  const descriptors = useMemo(() => {
    if (!viewState || !viewState.pages || viewState.pages.length === 0) return [];
    // NODE_ENTITY_COLLECTION is a single-page view containing all direct entities of a node
    const page = viewState.pages[0];
    return page.items.filter(
      (item): item is Extract<typeof item, { type: 'row' }> =>
        item.type === 'row' && item.reference.namespace.startsWith('entity:')
    );
  }, [viewState]);

  void cacheRevision;
  const entities = descriptors
    .map((descriptor) =>
      AppCache.getEntityCache(descriptor.reference.namespace.slice('entity:'.length))
        .get(descriptor.reference.id)
    )
    .filter(Boolean) as ClientEntity[];

  return {
    entities,
    isLoading,
    error: viewState?.error || null,
  };
}
