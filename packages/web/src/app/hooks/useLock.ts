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
  const ownsLockRef = useRef(false);
  const { registerActiveLock } = useHumanActivity();

  const acquireLock = useCallback(async (): Promise<boolean> => {
    setError(null);
    const result = await acquireLockAction(resourceType, resourceId);
    if (!result.success) {
      setError(result.message || 'Impossibile entrare in modalità modifica.');
      return false;
    }

    AppCache.setLockState(resourceType, resourceId, {
      locked: true,
      byUserId: currentUserId,
      bySessionId: currentSessionId,
      expiresAt: result.lock.expiresAt,
    });
    return true;
  }, [currentSessionId, currentUserId, resourceId, resourceType]);

  const releaseLock = useCallback(async (): Promise<void> => {
    if (!ownsLockRef.current) return;
    const result = await releaseLockAction(resourceType, resourceId);
    if (!result.success) {
      setError(result.message || 'Impossibile rilasciare il lock.');
      return;
    }

    AppCache.setLockState(resourceType, resourceId, { locked: false });
  }, [resourceId, resourceType]);

  useEffect(() => {
    void AppCache.hydrateLockState(resourceType, resourceId);
  }, [resourceId, resourceType]);

  useEffect(() => {
    if (lockState.locked && lockState.bySessionId === currentSessionId) {
      ownsLockRef.current = true;
      return registerActiveLock({ resourceType, resourceId });
    } else {
      ownsLockRef.current = false;
    }
  }, [currentSessionId, lockState.bySessionId, lockState.locked, registerActiveLock, resourceId, resourceType]);

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
    window.addEventListener('beforeunload', releaseOnPageExit);
    return () => {
      window.removeEventListener('pagehide', releaseOnPageExit);
      window.removeEventListener('beforeunload', releaseOnPageExit);
      if (ownsLockRef.current) {
        ownsLockRef.current = false;
        void releaseLockAction(resourceType, resourceId);
        AppCache.setLockState(resourceType, resourceId, { locked: false });
      }
    };
  }, [resourceId, resourceType]);

  const isMyLock = useMemo(
    () => lockState.locked && !!currentSessionId && lockState.bySessionId === currentSessionId,
    [currentSessionId, lockState.bySessionId, lockState.locked]
  );
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
