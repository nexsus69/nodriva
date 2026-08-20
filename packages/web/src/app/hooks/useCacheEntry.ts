import { useState, useEffect } from 'react';

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
  const [data, setData] = useState<T | null>(id ? cacheClient.get(id) : null);
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

    const hydrate = () => {
      if (!cacheClient.needsFetch(id, requireComplete)) return;
      setIsLoading(true);
      void cacheClient.fetchIfMissing(id, requireComplete)
        .catch((fetchError: unknown) => {
          if (!isMounted) return;
          setData(null);
          setError(fetchError instanceof Error ? fetchError : new Error(String(fetchError)));
          setErrorId(id);
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });
    };

    // 2. Subscribe to changes
    const unsubscribe = cacheClient.subscribe(id, (newData, newError) => {
      setData(newData);
      setError(newError);
      setErrorId(newError ? id : null);
      
      setIsLoading(cacheClient.needsFetch(id, requireComplete));
      if (!newError) hydrate();
    });

    // 3. Trigger fetch if missing or partial
    hydrate();

    // 4. Release on unmount (Decrement RefCount / GC)
    return () => {
      isMounted = false;
      unsubscribe();
      cacheClient.release(id);
    };
  }, [cacheClient, id, requireComplete]);

  return {
    data: id ? cacheClient.get(id) ?? (data?.id === id ? data : null) : null,
    error: id && errorId === id ? error : null,
    isLoading: id ? cacheClient.needsFetch(id, requireComplete) || isLoading : false,
  };
}
