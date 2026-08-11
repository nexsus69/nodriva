import { useEffect, useMemo, useState } from 'react';
import { AppCache } from '../cache/GlobalCacheClient';
import { NodeTypeMeta, EntityTypeMeta } from '../types/models';

export function useSemanticMetadata() {
  const [nodeTypesList, setNodeTypesList] = useState<readonly NodeTypeMeta[]>([]);
  const [entityTypesList, setEntityTypesList] = useState<readonly EntityTypeMeta[]>([]);
  const [nodeError, setNodeError] = useState<Error | null>(null);
  const [entityError, setEntityError] = useState<Error | null>(null);
  const [isNodeLoading, setIsNodeLoading] = useState(true);
  const [isEntityLoading, setIsEntityLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const unsubscribeNode = AppCache.metadata.subscribe('node', (records, error) => {
      if (!active) return;
      setNodeTypesList(records as readonly NodeTypeMeta[]);
      setNodeError(error ?? null);
      setIsNodeLoading(false);
    });
    const unsubscribeEntity = AppCache.metadata.subscribe('entity', (records, error) => {
      if (!active) return;
      setEntityTypesList(records as readonly EntityTypeMeta[]);
      setEntityError(error ?? null);
      setIsEntityLoading(false);
    });
    return () => {
      active = false;
      unsubscribeNode();
      unsubscribeEntity();
    };
  }, []);

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
    error: nodeError || entityError,
  };
}
