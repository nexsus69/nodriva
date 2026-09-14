'use client';

/** Synchronizes authorized cache/realtime channels and the current mutation origin. */

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { CacheGarbageCollector } from '../cache/CacheGarbageCollector';
import { AppCache } from '../cache/GlobalCacheClient';
import { runtimeTiming } from '../../config/runtimeTiming';
import { activityDebugStore } from '../activity/ActivityDebugStore';
import { useHumanActivity } from '../activity/ActivityProvider';
import { reconcileMetadataBestEffort } from '../cache/metadataReconciliation';
import type { RealtimeChannelCheckpoint } from '../cache/RealtimeCacheBridge';

interface PassiveSyncResponse {
  dataChannels: string[];
  lockChannels: string[];
  virtualRootNodeIds: string[];
  realtimeEnabled: boolean;
  realtimeCheckpoints: RealtimeChannelCheckpoint[];
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
    AppCache.setRealtimeOriginSession(session?.activitySessionId);
  }, [session?.activitySessionId]);

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
      if (document.visibilityState !== 'visible') return;
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
          AppCache.markRealtimeContinuityUnknown();
          activityDebugStore.syncFinished('server-error', performance.now() - startedAt);
          return;
        }
        const result = await response.json() as PassiveSyncResponse;
        AppCache.setRealtimeEnabled(result.realtimeEnabled);
        AppCache.observeRealtimeChannels(result.dataChannels);
        AppCache.observeRealtimeCheckpoints(result.realtimeCheckpoints);
        if (!result.realtimeEnabled) {
          releaseChannels?.();
          releaseChannels = undefined;
          retainedChannelKey = '';
        }
        const channelKey = JSON.stringify([
          [...result.dataChannels].sort(),
          [...result.lockChannels].sort(),
        ]);
        if (result.realtimeEnabled && channelKey !== retainedChannelKey) {
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
        // A transport failure leaves the rendered snapshot intact only until
        // the shared cache can mark it unreliable and request fresh data.
        AppCache.markRealtimeContinuityUnknown();
        activityDebugStore.syncFinished('network-error', performance.now() - startedAt);
      });
    };
    synchronizeAccess();
    const reconcileMetadata = (source: string) => {
      reconcileMetadataBestEffort(() => AppCache.reconcileMetadata(), source);
    };
    reconcileMetadata('session bootstrap');
    // Il realtime è il canale primario; il polling è una riconciliazione
    // passiva e non rinnova più la sessione. Al ritorno dal background viene
    // eseguito anche un riallineamento immediato.
    const synchronizeWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        synchronizeAccess();
        reconcileMetadata('visibility return');
      }
    };
    document.addEventListener('visibilitychange', synchronizeWhenVisible);
    window.addEventListener('online', synchronizeAccess);
    const accessRefresh = window.setInterval(
      synchronizeAccess,
      runtimeTiming.realtimeContinuityCheckIntervalMs,
    );
    const metadataRefresh = window.setInterval(
      () => reconcileMetadata('periodic polling'),
      timing.metadataReconciliationIntervalMs,
    );

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', synchronizeWhenVisible);
      window.removeEventListener('online', synchronizeAccess);
      window.clearInterval(accessRefresh);
      window.clearInterval(metadataRefresh);
      CacheGarbageCollector.stop();
      releaseChannels?.();
    };
  }, [isSessionExpired, timing.metadataReconciliationIntervalMs, userId]);

  return null;
}
