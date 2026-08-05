'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { CacheGarbageCollector } from '../cache/CacheGarbageCollector';
import { AppCache } from '../cache/GlobalCacheClient';
import {
  listRealtimeChannelsAction,
  listVirtualRootNodeIdsAction,
} from '../actions/realtimeActions';

export function CacheInitializer() {
  const { data: session } = useSession();
  const userId = session?.userId;

  useEffect(() => {
    // Le Server Action richiedono una sessione valida. Evitiamo tentativi al
    // bootstrap della pagina di login o dopo la scadenza della sessione: non è
    // un errore realtime e non deve produrre retry periodici in console.
    if (!userId) {
      AppCache.purgeAll();
      return;
    }

    // Avvio del Garbage Collector delle view semantiche (idempotente)
    // Esegue sweep ogni 30s usando i default
    CacheGarbageCollector.start(30000);

    let releaseChannels: (() => void) | undefined;
    let disposed = false;
    let retainedChannelKey = '';
    const synchronizeAccess = () => void Promise.all([listRealtimeChannelsAction(), listVirtualRootNodeIdsAction()]).then(
      ([channelsResult, virtualRootsResult]) => {
        if (disposed) return;
        if (channelsResult.success) {
          const channelKey = JSON.stringify([
            [...channelsResult.data.dataChannels].sort(),
            [...channelsResult.data.lockChannels].sort(),
          ]);
          if (channelKey !== retainedChannelKey) {
            releaseChannels?.();
            releaseChannels = AppCache.retainRealtimeChannels(
              channelsResult.data.dataChannels,
              channelsResult.data.lockChannels,
            );
            retainedChannelKey = channelKey;
          }
        } else if (channelsResult.error.code === 'AUTH_UNAUTHORIZED') {
          // La sessione può scadere tra un refresh e il successivo. La cache
          // viene ripulita; SessionProvider/il middleware governano il login.
          AppCache.purgeAll();
          return;
        } else {
          console.error('[CacheInitializer] Failed to resolve realtime channels:', channelsResult.error);
        }
        if (virtualRootsResult.success) {
          AppCache.setVirtualRootNodeIds(virtualRootsResult.data);
        } else if (virtualRootsResult.error.code === 'AUTH_UNAUTHORIZED') {
          AppCache.purgeAll();
          return;
        } else {
          console.error('[CacheInitializer] Failed to resolve virtual roots:', virtualRootsResult.error);
        }
      },
    ).catch((error: unknown) => {
      console.error('[CacheInitializer] Unexpected realtime initialization error:', error);
    });
    synchronizeAccess();
    // Server-side termination is the immediate revocation mechanism. This
    // reconciliation is a provider-independent safety net and also refreshes
    // virtual roots after an ACL change in another admin session.
    const accessRefresh = window.setInterval(synchronizeAccess, 60_000);

    return () => {
      disposed = true;
      window.clearInterval(accessRefresh);
      CacheGarbageCollector.stop();
      releaseChannels?.();
    };
  }, [userId]);

  return null;
}
