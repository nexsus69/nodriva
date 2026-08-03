'use client';

import { useEffect, useState } from 'react';
import { AppCache } from '../../cache/GlobalCacheClient';
import type { RealtimeDebugEvent } from '../../cache/RealtimeCacheBridge';
import { RealtimeDebugOverlay } from './RealtimeDebugOverlay';

export function RealtimeDebugOverlayHost() {
  const enabled = process.env.NEXT_PUBLIC_REALTIME_DEBUG === 'true';
  const [events, setEvents] = useState<RealtimeDebugEvent[]>(() => AppCache.getRealtimeDebugEvents());

  useEffect(() => {
    if (!enabled) return undefined;
    return AppCache.subscribeRealtimeDebug(setEvents);
  }, [enabled]);

  if (!enabled) return null;
  return <RealtimeDebugOverlay events={events} onClear={AppCache.clearRealtimeDebugEvents} />;
}
