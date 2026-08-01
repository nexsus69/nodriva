import { useMemo } from 'react';
import { useSemanticView } from './useSemanticView';
import { AppCache } from '../cache/GlobalCacheClient';
import { NodeTypeMeta, EntityTypeMeta } from '../types/models';

export function useSemanticMetadata() {
  const { viewState: nodeTypesView } = useSemanticView(
    { viewType: 'METADATA_LIST', metadataType: 'node' },
    true,
    'persistent'
  );

  const { viewState: entityTypesView } = useSemanticView(
    { viewType: 'METADATA_LIST', metadataType: 'entity' },
    true,
    'persistent'
  );
  
  const isNodeLoading = !nodeTypesView || nodeTypesView.status === 'loading';
  const isEntityLoading = !entityTypesView || entityTypesView.status === 'loading';

  const nodeTypesList = useMemo(() => {
    if (!nodeTypesView || !nodeTypesView.pages || nodeTypesView.pages.length === 0) return [];
    const page = nodeTypesView.pages[0];
    const ids = page.items.filter(item => item.type === 'row').map(item => item.id);
    return ids.map(id => AppCache.nodeTypes.get(id)).filter(Boolean) as NodeTypeMeta[];
  }, [nodeTypesView]);

  const entityTypesList = useMemo(() => {
    if (!entityTypesView || !entityTypesView.pages || entityTypesView.pages.length === 0) return [];
    const page = entityTypesView.pages[0];
    const ids = page.items.filter(item => item.type === 'row').map(item => item.id);
    return ids.map(id => AppCache.entityTypes.get(id)).filter(Boolean) as EntityTypeMeta[];
  }, [entityTypesView]);

  const nodeTypes = useMemo(() => {
    const map: Record<string, NodeTypeMeta> = {};
    nodeTypesList.forEach(t => {
      map[t.id] = t;
      map[t.typeKey] = t;
    });
    return map;
  }, [nodeTypesList]);

  const entityTypes = useMemo(() => {
    const map: Record<string, EntityTypeMeta> = {};
    entityTypesList.forEach(t => {
      map[t.id] = t;
      map[t.typeKey] = t;
    });
    return map;
  }, [entityTypesList]);

  return {
    nodeTypesList,
    entityTypesList,
    nodeTypes,
    entityTypes,
    isLoading: isNodeLoading || isEntityLoading,
    error: nodeTypesView?.error || entityTypesView?.error || null,
  };
}
