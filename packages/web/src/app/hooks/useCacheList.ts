import { useState, useEffect } from 'react';
import { AppCache } from '../cache/GlobalCacheClient';

export function useCacheList(listId: string | null) {
  const [items, setItems] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!listId) {
      setItems([]);
      return;
    }

    AppCache.lists.retain(listId);

    const unsubscribe = AppCache.lists.subscribe(listId, (data) => {
      if (data && data.items) {
        setItems(data.items);
      }
    });

    const currentList = AppCache.lists.get(listId);
    if (currentList && currentList.items) {
      setItems(currentList.items);
    } else {
      setIsLoading(true);
      // Logic for triggering list fetch should be handled externally by an orchestrator or specific action
      // since list fetching (pagination, cursors) is highly specific.
    }

    return () => {
      unsubscribe();
      AppCache.lists.release(listId);
    };
  }, [listId]);

  return { items, isLoading };
}
