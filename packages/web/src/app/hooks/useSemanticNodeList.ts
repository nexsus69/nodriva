import { useCallback, useEffect, useState } from 'react';
import { AppCache } from '../cache/GlobalCacheClient';
import { ClientNode } from '../types/models';
import type { RetentionClass } from '../cache/PolicyRegistry';

export function useSemanticNodeList(
  parentId: string | null,
  options?: { retentionClass?: RetentionClass }
) {
  const [nodes, setNodes] = useState<readonly ClientNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    const unsubscribe = AppCache.nodes.subscribeChildren(parentId, (nextNodes, nextError) => {
      if (!active) return;
      setNodes(nextNodes);
      setError(nextError ?? null);
      setIsLoading(false);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [parentId]);

  const refresh = useCallback(() => {
    AppCache.nodes.invalidateChildren();
  }, []);

  void options?.retentionClass;

  return {
    nodes,
    isLoading,
    error,
    refresh,
  };
}
