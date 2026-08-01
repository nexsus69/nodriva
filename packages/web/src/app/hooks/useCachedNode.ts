'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { AppCache } from '../cache/GlobalCacheClient';
import type { ClientNode } from '../types/models';

/**
 * Reactive cache-only node lookup.
 *
 * Unlike useCacheNode, this hook never hydrates a missing/partial entry and
 * therefore cannot cause a server request. It is intended for presentational
 * consumers whose owning semantic view already coordinates data loading.
 */
export function useCachedNode(id: string): ClientNode | null {
  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      AppCache.nodes.subscribe(id, () => onStoreChange()),
    [id]
  );
  const getSnapshot = useCallback(() => AppCache.nodes.get(id), [id]);
  const getServerSnapshot = useCallback(() => null, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
