/** Exposes one cache record only after its cache-hit continuity gate completes. */
import { useState, useEffect } from 'react';
import { AppCache } from '../cache/GlobalCacheClient';

interface CacheEntryClient<T extends { id: string }> {
  get(id: string): T | null;
  retain(id: string): void;
  release(id: string): void;
  needsFetch(id: string, requireComplete: boolean): boolean;
  subscribe(id: string, callback: (data: T | null, error: Error | null) => void): () => void;
  fetchIfMissing(id: string, requireComplete: boolean): Promise<T | null>;
}

export function useCacheEntry<T extends { id: string }>(
  cacheClient: CacheEntryClient<T>,
  id: string | null,
  requireComplete: boolean = false
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(
    id ? cacheClient.needsFetch(id, requireComplete) : false
  );

  useEffect(() => {
    if (!id) {
      return;
    }

    // 1. Retain the entry (Increment RefCount)
    cacheClient.retain(id);
    let isMounted = true;
    let mayExposeCachedData = false;

    const load = async () => {
      const cached = cacheClient.get(id);
      const cacheHit = cached !== null && !cacheClient.needsFetch(id, requireComplete);
      setIsLoading(true);
      try {
        if (cacheHit) {
          const continuous = await AppCache.ensureReadModelContinuityForCacheHit();
          if (continuous) {
            mayExposeCachedData = true;
            if (isMounted) setData(cacheClient.get(id));
            return;
          }
        }
        mayExposeCachedData = true;
        const fetched = await cacheClient.fetchIfMissing(id, requireComplete);
        if (isMounted) setData(fetched);
      } catch (fetchError: unknown) {
        if (!isMounted) return;
        setData(null);
        setError(fetchError instanceof Error ? fetchError : new Error(String(fetchError)));
        setErrorId(id);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    // 2. Subscribe only after the cache-hit continuity gate has completed.
    const unsubscribe = cacheClient.subscribe(id, (newData, newError) => {
      if (mayExposeCachedData || newData === null) setData(newData);
      setError(newError);
      setErrorId(newError ? id : null);
    });

    // 3. A missing or incomplete record fetches directly; a cache hit is gated.
    void load();

    // 4. Release on unmount (Decrement RefCount / GC)
    return () => {
      isMounted = false;
      unsubscribe();
      cacheClient.release(id);
    };
  }, [cacheClient, id, requireComplete]);

  return {
    data: id && data?.id === id ? data : null,
    error: id && errorId === id ? error : null,
    isLoading: id ? isLoading : false,
  };
}
