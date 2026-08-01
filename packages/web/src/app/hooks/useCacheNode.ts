import { AppCache } from '../cache/GlobalCacheClient';
import { useCacheEntry } from './useCacheEntry';

export function useCacheNode(id: string | null) {
  return useCacheEntry(AppCache.nodes, id, true);
}
