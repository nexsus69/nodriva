'use client';

import { useSyncExternalStore } from 'react';
import { AppCache } from '../cache/GlobalCacheClient';

export function useAppCacheRevision(): number {
  return useSyncExternalStore(
    AppCache.subscribe,
    AppCache.getRevision,
    AppCache.getRevision
  );
}
