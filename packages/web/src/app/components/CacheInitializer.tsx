'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { CacheGarbageCollector } from '../cache/CacheGarbageCollector';
import { AppCache } from '../cache/GlobalCacheClient';
import { runtimeTiming } from '../../config/runtimeTiming';
import { activityDebugStore } from '../activity/ActivityDebugStore';
import { useHumanActivity } from '../activity/ActivityProvider';

interface PassiveSyncResponse {
  dataChannels: string[];
  lockChannels: string[];
  virtualRootNodeIds: string[];
}

function isLoginRedirect(response: Response): boolean {
  if (!response.redirected) return false;
  try {
    return new URL(response.url).pathname === '/login';
  } catch {
    return false;
  }
}

export function CacheInitializer() {
  const { data: session } = useSession();
  const userId = session?.userId;
  const { isSessionExpired, timing } = useHumanActivity();

  useEffect(() => {
    // Evitiamo polling al bootstrap della pagina di login o dopo la scadenza.
    if (!userId || isSessionExpired) {
      AppCache.purgeAll();
      return;
    }

    // Avvio del Garbage Collector delle view semantiche (idempotente).
    CacheGarbageCollector.start(runtimeTiming.cacheSweepIntervalMs);

    let releaseChannels: (() => void) | undefined;
    let disposed = false;
    let retainedChannelKey = '';
    const synchronizeAccess = () => {
      const startedAt = performance.now();
      activityDebugStore.syncStarted();
      void fetch('/api/sync/access', {
        method: 'GET',
        cache: 'no-store',
      }).then(async (response) => {
        if (disposed) return;
        if (response.status === 401 || isLoginRedirect(response)) {
          AppCache.purgeAll();
          activityDebugStore.syncFinished('unauthorized', performance.now() - startedAt);
          return;
        }
        if (!response.ok) {
          activityDebugStore.syncFinished('server-error', performance.now() - startedAt);
          return;
        }
        const result = await response.json() as PassiveSyncResponse;
        const channelKey = JSON.stringify([
          [...result.dataChannels].sort(),
          [...result.lockChannels].sort(),
        ]);
        if (channelKey !== retainedChannelKey) {
          releaseChannels?.();
          releaseChannels = AppCache.retainRealtimeChannels(
            result.dataChannels,
            result.lockChannels,
          );
          retainedChannelKey = channelKey;
        }
        AppCache.setVirtualRootNodeIds(result.virtualRootNodeIds);
        activityDebugStore.syncFinished('success', performance.now() - startedAt, {
          dataChannels: result.dataChannels.length,
          lockChannels: result.lockChannels.length,
          virtualRoots: result.virtualRootNodeIds.length,
        });
      }).catch(() => {
        // Il polling è una rete di sicurezza: una sospensione o perdita di rete
        // non deve produrre errori applicativi né invalidare cache/sessione.
        activityDebugStore.syncFinished('network-error', performance.now() - startedAt);
      });
    };
    synchronizeAccess();
    // Il realtime è il canale primario; il polling è una riconciliazione
    // passiva e non rinnova più la sessione. Al ritorno dal background viene
    // eseguito anche un riallineamento immediato.
    const synchronizeWhenVisible = () => {
      if (document.visibilityState === 'visible') synchronizeAccess();
    };
    document.addEventListener('visibilitychange', synchronizeWhenVisible);
    const accessRefresh = window.setInterval(
      synchronizeAccess,
      timing.syncPollingIntervalMs,
    );

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', synchronizeWhenVisible);
      window.clearInterval(accessRefresh);
      CacheGarbageCollector.stop();
      releaseChannels?.();
    };
  }, [isSessionExpired, timing.syncPollingIntervalMs, userId]);

  return null;
}
