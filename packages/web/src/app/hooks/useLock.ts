'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from 'react';
import { useSession } from 'next-auth/react';
import {
  acquireLockAction,
  releaseLockAction,
} from '../actions/lockActions';
import type { ResourceReference } from '@dashboard/core';
import { AppCache } from '../cache/GlobalCacheClient';
import { useHumanActivity } from '../activity/ActivityProvider';

type UseLockProps = ResourceReference;

/** Holds deferred cleanup releases while Next.js refreshes a client subtree after a Server Action. */
const scheduledLockReleases = new Map<string, ReturnType<typeof setTimeout>>();

/** Preserves a server-confirmed browser ownership across a Next.js route refresh. */
const confirmedBrowserLockSessions = new Map<string, string>();

function lockReleaseKey({ resourceType, resourceId }: ResourceReference): string {
  return `${resourceType}:${resourceId}`;
}

function cancelScheduledLockRelease(reference: ResourceReference): void {
  const key = lockReleaseKey(reference);
  const timer = scheduledLockReleases.get(key);
  if (!timer) return;
  clearTimeout(timer);
  scheduledLockReleases.delete(key);
}

function rememberBrowserLock(reference: ResourceReference, sessionId: string): void {
  confirmedBrowserLockSessions.set(lockReleaseKey(reference), sessionId);
}

function forgetBrowserLock(reference: ResourceReference): void {
  confirmedBrowserLockSessions.delete(lockReleaseKey(reference));
}

function getRememberedBrowserLockSession(reference: ResourceReference): string | undefined {
  return confirmedBrowserLockSessions.get(lockReleaseKey(reference));
}

/**
 * Gives a remounted hook one event-loop turn to reclaim its existing lock.
 * A Server Action can refresh the current route without the user leaving it.
 */
function scheduleLockRelease(reference: ResourceReference, release: () => void): void {
  cancelScheduledLockRelease(reference);
  const key = lockReleaseKey(reference);
  const timer = setTimeout(() => {
    scheduledLockReleases.delete(key);
    release();
  }, 0);
  scheduledLockReleases.set(key, timer);
}

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
  const [, startLockTransition] = useTransition();

  /** Dispatches the authoritative lock mutation through React's Server Action transition. */
  const acquireLock = useCallback(async (): Promise<boolean> => {
    return new Promise((resolve) => {
      startLockTransition(() => {
        void (async () => {
          setError(null);
          const result = await acquireLockAction(resourceType, resourceId);
          if (!result.success) {
            setError(result.message || 'Impossibile entrare in modalità modifica.');
            resolve(false);
            return;
          }

          // The server action is authoritative. The session returned here can be
          // available before the client session provider finishes synchronizing.
          setAcquiredSessionId(result.lock.sessionId);
          rememberBrowserLock({ resourceType, resourceId }, result.lock.sessionId);
          ownsLockRef.current = true;
          AppCache.setLockState(resourceType, resourceId, {
            locked: true,
            byUserId: currentUserId,
            bySessionId: result.lock.sessionId,
            expiresAt: result.lock.expiresAt,
          });
          resolve(true);
        })();
      });
    });
  }, [currentUserId, resourceId, resourceType, startLockTransition]);

  /** Releases an owned lock through the same Server Action boundary used for acquisition. */
  const releaseLock = useCallback(async (): Promise<void> => {
    cancelScheduledLockRelease({ resourceType, resourceId });
    if (!ownsLockRef.current) return;
    await new Promise<void>((resolve) => {
      startLockTransition(() => {
        void (async () => {
          const result = await releaseLockAction(resourceType, resourceId);
          if (!result.success) {
            setError(result.message || 'Impossibile rilasciare il lock.');
            resolve();
            return;
          }

          setAcquiredSessionId(undefined);
          forgetBrowserLock({ resourceType, resourceId });
          AppCache.setLockState(resourceType, resourceId, { locked: false });
          resolve();
        })();
      });
    });
  }, [resourceId, resourceType, startLockTransition]);

  useEffect(() => {
    void AppCache.hydrateLockState(resourceType, resourceId);
  }, [resourceId, resourceType]);

  const isMyLock = useMemo(
    () => isOwnedLock(
      lockState,
      currentSessionId,
      acquiredSessionId ?? getRememberedBrowserLockSession({ resourceType, resourceId }),
    ),
    [acquiredSessionId, currentSessionId, lockState, resourceId, resourceType],
  );

  useEffect(() => {
    if (isMyLock) cancelScheduledLockRelease({ resourceType, resourceId });
  }, [isMyLock, resourceId, resourceType]);

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
      cancelScheduledLockRelease({ resourceType, resourceId });
      forgetBrowserLock({ resourceType, resourceId });
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
        scheduleLockRelease(
          { resourceType, resourceId },
          () => {
            forgetBrowserLock({ resourceType, resourceId });
            void releaseLockAction(resourceType, resourceId);
            AppCache.setLockState(resourceType, resourceId, { locked: false });
          },
        );
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
