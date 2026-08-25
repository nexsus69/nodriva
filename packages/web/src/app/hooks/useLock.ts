'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useSession } from 'next-auth/react';
import {
  acquireLockAction,
  releaseLockAction,
} from '../actions/lockActions';
import type { ResourceReference } from '@dashboard/core';
import { AppCache } from '../cache/GlobalCacheClient';
import { useHumanActivity } from '../activity/ActivityProvider';

type UseLockProps = ResourceReference;

/** Checks whether a lock belongs to the current browser or its last server-confirmed acquisition. */
export function isOwnedLock(
  lockState: { locked: boolean; bySessionId?: string },
  currentSessionId?: string,
  acquiredSessionId?: string,
): boolean {
  if (!lockState.locked || !lockState.bySessionId) return false;
  return lockState.bySessionId === currentSessionId
    || lockState.bySessionId === acquiredSessionId;
}

export function useLock({ resourceType, resourceId }: UseLockProps) {
  const { data: session } = useSession();
  const currentUserId = (session as { userId?: string } | null)?.userId;
  const currentSessionId = session?.activitySessionId;
  const subscribeLock = useCallback(
    (onStoreChange: () => void) =>
      AppCache.subscribeLock(resourceType, resourceId, onStoreChange),
    [resourceId, resourceType]
  );
  const getLockSnapshot = useCallback(
    () => AppCache.getLockState(resourceType, resourceId),
    [resourceId, resourceType]
  );
  const lockState = useSyncExternalStore(
    subscribeLock,
    getLockSnapshot,
    getLockSnapshot
  );
  const [error, setError] = useState<string | null>(null);
  const [acquiredSessionId, setAcquiredSessionId] = useState<string>();
  const ownsLockRef = useRef(false);
  const { registerActiveLock } = useHumanActivity();

  const acquireLock = useCallback(async (): Promise<boolean> => {
    setError(null);
    const result = await acquireLockAction(resourceType, resourceId);
    if (!result.success) {
      setError(result.message || 'Impossibile entrare in modalità modifica.');
      return false;
    }

    // The server action is authoritative. The session returned here can be
    // available before the client session provider finishes synchronizing.
    setAcquiredSessionId(result.lock.sessionId);
    ownsLockRef.current = true;
    AppCache.setLockState(resourceType, resourceId, {
      locked: true,
      byUserId: currentUserId,
      bySessionId: result.lock.sessionId,
      expiresAt: result.lock.expiresAt,
    });
    return true;
  }, [currentUserId, resourceId, resourceType]);

  const releaseLock = useCallback(async (): Promise<void> => {
    if (!ownsLockRef.current) return;
    const result = await releaseLockAction(resourceType, resourceId);
    if (!result.success) {
      setError(result.message || 'Impossibile rilasciare il lock.');
      return;
    }

    setAcquiredSessionId(undefined);
    AppCache.setLockState(resourceType, resourceId, { locked: false });
  }, [resourceId, resourceType]);

  useEffect(() => {
    void AppCache.hydrateLockState(resourceType, resourceId);
  }, [resourceId, resourceType]);

  const isMyLock = useMemo(
    () => isOwnedLock(lockState, currentSessionId, acquiredSessionId),
    [acquiredSessionId, currentSessionId, lockState],
  );

  useEffect(() => {
    if (isMyLock) {
      ownsLockRef.current = true;
      return registerActiveLock({ resourceType, resourceId });
    }
    ownsLockRef.current = false;
    return undefined;
  }, [isMyLock, registerActiveLock, resourceId, resourceType]);

  useEffect(() => {
    const releaseOnPageExit = () => {
      if (!ownsLockRef.current) return;
      const body = JSON.stringify({ resourceType, resourceId });
      const payload = new Blob([body], { type: 'application/json' });
      const sent = typeof navigator.sendBeacon === 'function'
        && navigator.sendBeacon('/api/locks/release', payload);
      if (!sent) {
        void fetch('/api/locks/release', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => undefined);
      }
      ownsLockRef.current = false;
    };

    window.addEventListener('pagehide', releaseOnPageExit);
    return () => {
      window.removeEventListener('pagehide', releaseOnPageExit);
      if (ownsLockRef.current) {
        ownsLockRef.current = false;
        void releaseLockAction(resourceType, resourceId);
        AppCache.setLockState(resourceType, resourceId, { locked: false });
      }
    };
  }, [resourceId, resourceType]);

  const lockedByOther = useMemo(
    () => ({
      locked: lockState.locked && !isMyLock,
      byUserId: lockState.byUserId,
    }),
    [isMyLock, lockState.byUserId, lockState.locked]
  );

  return {
    lockedByOther,
    isMyLock,
    error,
    acquireLock,
    releaseLock,
  };
}
