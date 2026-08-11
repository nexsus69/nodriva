'use client';

import { useEffect, useState } from 'react';
import { AppCache } from '../../cache/GlobalCacheClient';
import type { RealtimeDebugEvent } from '../../cache/RealtimeCacheBridge';
import { RealtimeDebugOverlay } from './RealtimeDebugOverlay';

export function RealtimeDebugOverlayHost() {
  const enabled = process.env.NEXT_PUBLIC_REALTIME_DEBUG === 'true';
  const [events, setEvents] = useState<RealtimeDebugEvent[]>(() => AppCache.getRealtimeDebugEvents());
  const [connectionState, setConnectionState] = useState(() => AppCache.getRealtimeConnectionState());

  useEffect(() => {
    if (!enabled) return undefined;
    const releaseDebug = AppCache.subscribeRealtimeDebug(setEvents);
    const releaseState = AppCache.subscribeRealtimeState(() => setConnectionState(AppCache.getRealtimeConnectionState()));
    return () => {
      releaseDebug();
      releaseState();
    };
  }, [enabled]);

  if (!enabled) return null;
  return <RealtimeDebugOverlay events={events} connectionState={connectionState} capabilityEnabled={AppCache.getRealtimeCapabilityEnabled()} onClear={AppCache.clearRealtimeDebugEvents} />;
}
