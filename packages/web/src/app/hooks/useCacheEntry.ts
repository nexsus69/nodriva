import { useState, useEffect } from 'react';
import { DomainCacheClient } from '../cache/DomainCacheClient';

export function useCacheEntry<T extends { id: string }>(
  cacheClient: DomainCacheClient<T>,
  id: string | null,
  requireComplete: boolean = false
) {
  const [data, setData] = useState<T | null>(id ? cacheClient.get(id) : null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(
    id ? cacheClient.needsFetch(id, requireComplete) : false
  );

  useEffect(() => {
    if (!id) {
      return;
    }

    // 1. Retain the entry (Increment RefCount)
    cacheClient.retain(id);

    // 2. Subscribe to changes
    const unsubscribe = cacheClient.subscribe(id, (newData, newError) => {
      setData(newData);
      setError(newError);
      
      // If we required complete data, we stop loading when the data is no longer partial
      if (newData && requireComplete) {
        // We can't access isPartial easily from here without changing the subscribe callback signature,
        // but if data arrived and no error, we assume the fetch resolved if it was pending.
        // Actually, checking needsFetch is safer.
        setIsLoading(cacheClient.needsFetch(id, requireComplete));
      } else if (newData || newError) {
        setIsLoading(false);
      }
    });

    // 3. Trigger fetch if missing or partial
    let isMounted = true;
    if (cacheClient.needsFetch(id, requireComplete)) {
      cacheClient
        .fetchIfMissing(id, requireComplete)
        .catch(() => {
          // Error is already handled and broadcasted to subscribers by the client
        })
        .finally(() => {
          if (isMounted) {
            setIsLoading(false);
          }
        });
    }

    // 4. Release on unmount (Decrement RefCount / GC)
    return () => {
      isMounted = false;
      unsubscribe();
      cacheClient.release(id);
    };
  }, [cacheClient, id, requireComplete]);

  return {
    data: id ? cacheClient.get(id) ?? data : null,
    error: id ? error : null,
    isLoading: id ? cacheClient.needsFetch(id, requireComplete) || isLoading : false,
  };
}
