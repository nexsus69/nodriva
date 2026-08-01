import { AppCache } from '../cache/GlobalCacheClient';
import { useCacheEntry } from './useCacheEntry';

export function useCacheEntity(entityTypeKey: string, id: string | null, requireComplete: boolean = false) {
  const cacheClient = AppCache.getEntityCache(entityTypeKey);
  return useCacheEntry(cacheClient, id, requireComplete);
}
