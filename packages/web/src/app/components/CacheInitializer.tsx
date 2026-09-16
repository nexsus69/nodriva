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

/** Distinguishes an auth refetch from a confirmed identity boundary. */
export function shouldPurgeCacheForSession(
  status: 'loading' | 'authenticated' | 'unauthenticated',
  isSessionExpired: boolean,
): boolean {
  return status === 'unauthenticated' || isSessionExpired;
}

export function CacheInitializer() {
  const { data: session, status } = useSession();
  const userId = session?.userId;
  const { isSessionExpired, timing } = useHumanActivity();

  useEffect(() => {
    AppCache.setRealtimeOriginSession(session?.activitySessionId);
  }, [session?.activitySessionId]);

  useEffect(() => {
    // During NextAuth bootstrap/refetch, `data` can temporarily be undefined.
    // That is not an identity boundary: purging here aborts authoritative reads
    // already started by the mounted screen. Only an established unauthenticated
    // state (or an expired session) may discard the cache.
    if (status === 'loading') return;
    if (shouldPurgeCacheForSession(status, isSessionExpired)) {
      AppCache.purgeAll();
      return;
    }

    if (!userId) return;

    // Avvio del Garbage Collector delle view semantiche (idempotente).
    CacheGarbageCollector.start(runtimeTiming.cacheSweepIntervalMs);

    let disposed = false;
    const synchronizeAccess = () => {
      if (document.visibilityState !== 'visible') return;
      const startedAt = performance.now();
      activityDebugStore.syncStarted();
      void AppCache.synchronizeRealtimeAccess().then((continuous) => {
        if (disposed) return;
        activityDebugStore.syncFinished(continuous ? 'success' : 'network-error', performance.now() - startedAt);
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
    };
  }, [isSessionExpired, status, timing.metadataReconciliationIntervalMs, userId]);

  return null;
}
