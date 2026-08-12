'use client';

import { useSyncExternalStore } from 'react';
import { activityDebugStore } from './ActivityDebugStore';
import { ActivityDebugOverlay } from './ActivityDebugOverlay';

export function ActivityDebugOverlayHost() {
  // Keep diagnostics opt-in behind a second switch until the temporary panel
  // is removed. NEXT_PUBLIC_ACTIVITY_DEBUG alone must not affect normal UI.
  const enabled = process.env.NEXT_PUBLIC_DEBUG_OVERLAYS === 'true'
    && process.env.NEXT_PUBLIC_ACTIVITY_DEBUG === 'true';
  const snapshot = useSyncExternalStore(
    activityDebugStore.subscribe,
    activityDebugStore.getSnapshot,
    activityDebugStore.getServerSnapshot,
  );

  if (!enabled) return null;
  return (
    <ActivityDebugOverlay
      snapshot={snapshot}
      onClear={activityDebugStore.clearEvents}
    />
  );
}
