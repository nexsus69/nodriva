'use client';

import { useEffect } from 'react';
import { CacheGarbageCollector } from '../cache/CacheGarbageCollector';
import { AppCache } from '../cache/GlobalCacheClient';
import { listRealtimeScopeAssignmentsAction } from '../actions/realtimeActions';

export function CacheInitializer() {
  useEffect(() => {
    // Avvio del Garbage Collector delle view semantiche (idempotente)
    // Esegue sweep ogni 30s usando i default
    CacheGarbageCollector.start(30000);

    let releaseScopes: (() => void) | undefined;
    void listRealtimeScopeAssignmentsAction().then((result) => {
      if (result.success) releaseScopes = AppCache.retainRealtimeScopes(result.data);
    });

    return () => {
      CacheGarbageCollector.stop();
      releaseScopes?.();
    };
  }, []);

  return null;
}
