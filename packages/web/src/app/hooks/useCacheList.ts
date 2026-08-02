import { useState, useEffect } from 'react';
import { AppCache } from '../cache/GlobalCacheClient';

export function useCacheList(listId: string | null) {
  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
    if (!listId) {
      return;
    }

    AppCache.lists.retain(listId);

    const unsubscribe = AppCache.lists.subscribe(listId, (data) => {
      if (data && data.items) {
        setItems(data.items);
      }
    });

    // List fetching is orchestrated by the semantic view layer. The hook only
    // retains the cache entry and subscribes to updates.

    return () => {
      unsubscribe();
      AppCache.lists.release(listId);
    };
  }, [listId]);

  return {
    items: listId ? AppCache.lists.get(listId)?.items ?? items : [],
    isLoading: listId ? !AppCache.lists.get(listId)?.items : false,
  };
}
