'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useSession } from 'next-auth/react';
import {
  acquireLockAction,
  refreshLockAction,
  releaseLockAction,
} from '../actions/lockActions';
import { AppCache } from '../cache/GlobalCacheClient';

type LockResourceType = 'node' | 'entity';

interface UseLockProps {
  resourceType: LockResourceType;
  resourceId: string;
}

export function useLock({ resourceType, resourceId }: UseLockProps) {
  const { data: session } = useSession();
  const currentUserId = (session as { userId?: string } | null)?.userId;
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
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ownsLockRef = useRef(false);

  const stopRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const startRefreshTimer = useCallback(() => {
    stopRefreshTimer();
    refreshTimerRef.current = setInterval(async () => {
      const result = await refreshLockAction(resourceType, resourceId);
      if (!result.success) {
        stopRefreshTimer();
        AppCache.setLockState(resourceType, resourceId, { locked: false });
        setError(result.message || 'Il lock di modifica è scaduto.');
        return;
      }
      AppCache.setLockState(resourceType, resourceId, {
        locked: true,
        byUserId: currentUserId,
        expiresAt: result.lock.expiresAt,
      });
    }, 60_000);
  }, [currentUserId, resourceId, resourceType, stopRefreshTimer]);

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
      expiresAt: result.lock.expiresAt,
    });
    startRefreshTimer();
    return true;
  }, [currentUserId, resourceId, resourceType, startRefreshTimer]);

  const releaseLock = useCallback(async (): Promise<void> => {
    if (!ownsLockRef.current) return;
    const result = await releaseLockAction(resourceType, resourceId);
    if (!result.success) {
      setError(result.message || 'Impossibile rilasciare il lock.');
      return;
    }

    AppCache.setLockState(resourceType, resourceId, { locked: false });
    stopRefreshTimer();
  }, [resourceId, resourceType, stopRefreshTimer]);

  useEffect(() => {
    void AppCache.hydrateLockState(resourceType, resourceId);
  }, [resourceId, resourceType]);

  useEffect(() => {
    if (lockState.locked && lockState.byUserId === currentUserId) {
      ownsLockRef.current = true;
      startRefreshTimer();
    } else {
      ownsLockRef.current = false;
      stopRefreshTimer();
    }
    return stopRefreshTimer;
  }, [currentUserId, lockState.byUserId, lockState.locked, startRefreshTimer, stopRefreshTimer]);

  useEffect(() => {
    return () => {
      stopRefreshTimer();
      if (ownsLockRef.current) {
        ownsLockRef.current = false;
        void releaseLockAction(resourceType, resourceId);
        AppCache.setLockState(resourceType, resourceId, { locked: false });
      }
    };
  }, [resourceId, resourceType, stopRefreshTimer]);

  const isMyLock = useMemo(
    () => lockState.locked && !!currentUserId && lockState.byUserId === currentUserId,
    [currentUserId, lockState.byUserId, lockState.locked]
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
