'use client';

import { useEffect } from 'react';
import { CacheGarbageCollector } from '../cache/CacheGarbageCollector';
import { AppCache } from '../cache/GlobalCacheClient';
import {
  listRealtimeChannelsAction,
  listVirtualRootNodeIdsAction,
} from '../actions/realtimeActions';

export function CacheInitializer() {
  useEffect(() => {
    // Avvio del Garbage Collector delle view semantiche (idempotente)
    // Esegue sweep ogni 30s usando i default
    CacheGarbageCollector.start(30000);

    let releaseChannels: (() => void) | undefined;
    void Promise.all([listRealtimeChannelsAction(), listVirtualRootNodeIdsAction()]).then(
      ([channelsResult, virtualRootsResult]) => {
        if (channelsResult.success) {
          releaseChannels = AppCache.retainRealtimeChannels(
            channelsResult.data.dataChannels,
            channelsResult.data.lockChannels,
          );
        } else {
          console.error('[CacheInitializer] Failed to resolve realtime channels:', channelsResult.error);
        }
        if (virtualRootsResult.success) {
          AppCache.setVirtualRootNodeIds(virtualRootsResult.data);
        } else {
          console.error('[CacheInitializer] Failed to resolve virtual roots:', virtualRootsResult.error);
        }
      },
    ).catch((error: unknown) => {
      console.error('[CacheInitializer] Unexpected realtime initialization error:', error);
    });

    return () => {
      CacheGarbageCollector.stop();
      releaseChannels?.();
    };
  }, []);

  return null;
}
