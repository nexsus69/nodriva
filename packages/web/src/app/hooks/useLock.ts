'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  acquireLockAction,
  getLockStateAction,
  refreshLockAction,
  releaseLockAction,
} from '../actions/lockActions';
import { AppCache, CachedLockState } from '../cache/GlobalCacheClient';

type LockResourceType = 'node' | 'entity';

interface UseLockProps {
  resourceType: LockResourceType;
  resourceId: string;
}

export function useLock({ resourceType, resourceId }: UseLockProps) {
  const { data: session } = useSession();
  const currentUserId = (session as { userId?: string } | null)?.userId;
  const [lockState, setLockState] = useState<CachedLockState>(() =>
    AppCache.getLockState(resourceType, resourceId)
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

  const applyLockState = useCallback((state: CachedLockState) => {
    setLockState(state);
    ownsLockRef.current = !!currentUserId && state.locked && state.byUserId === currentUserId;
  }, [currentUserId]);

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
    let mounted = true;
    const unsubscribeState = AppCache.subscribeLock(resourceType, resourceId, (state) => {
      if (mounted) applyLockState(state);
    });
    const releaseRealtime = AppCache.retainLockResource(resourceType, resourceId);
    applyLockState(AppCache.getLockState(resourceType, resourceId));

    void getLockStateAction(resourceType, resourceId).then((state) => {
      if (!mounted) return;
      const current = AppCache.getLockState(resourceType, resourceId);
      // Do not let a slower snapshot overwrite a newer realtime acquisition.
      if (!current.locked || state.locked) {
        AppCache.setLockState(resourceType, resourceId, state);
      }
    });

    return () => {
      mounted = false;
      unsubscribeState();
      releaseRealtime();
    };
  }, [applyLockState, resourceId, resourceType]);

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
