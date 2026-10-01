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
import { useUserMutation } from '../mutations/useUserMutation';

type UseLockProps = ResourceReference;

/** Holds deferred cleanup releases while a client subtree remounts. */
const scheduledLockReleases = new Map<string, ReturnType<typeof setTimeout>>();

export const LOCK_RELEASE_ENDPOINT = '/api/locks/release';

/** Preserves a server-confirmed browser ownership across a Next.js route refresh. */
const confirmedBrowserLocks = new Map<string, { sessionId: string; lockId: string }>();

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

function rememberBrowserLock(reference: ResourceReference, sessionId: string, lockId: string): void {
  confirmedBrowserLocks.set(lockReleaseKey(reference), { sessionId, lockId });
}

function forgetBrowserLock(reference: ResourceReference, expectedLockId?: string): void {
  const key = lockReleaseKey(reference);
  if (!expectedLockId || confirmedBrowserLocks.get(key)?.lockId === expectedLockId) {
    confirmedBrowserLocks.delete(key);
  }
}

function getRememberedBrowserLock(reference: ResourceReference): { sessionId: string; lockId: string } | undefined {
  return confirmedBrowserLocks.get(lockReleaseKey(reference));
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

/** Releases a lock through the stable HTTP endpoint, safe across Server Action deployments. */
export function releaseLockThroughApi(reference: ResourceReference, preferBeacon = false, lockId?: string): void {
  const body = JSON.stringify(lockId ? { ...reference, lockId } : reference);
  const payload = new Blob([body], { type: 'application/json' });
  const sent = preferBeacon
    && typeof navigator.sendBeacon === 'function'
    && navigator.sendBeacon(LOCK_RELEASE_ENDPOINT, payload);
  if (sent) return;
  void fetch(LOCK_RELEASE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: preferBeacon,
  }).catch(() => undefined);
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
  const mutation = useUserMutation();
  const [acquiredSessionId, setAcquiredSessionId] = useState<string>();
  const [acquiredLockId, setAcquiredLockId] = useState<string>();
  const acquiredLockIdRef = useRef<string | undefined>(undefined);
  const ownsLockRef = useRef(false);
  const { registerActiveLock } = useHumanActivity();
  const [, startLockTransition] = useTransition();

  /** Dispatches the authoritative lock mutation through React's Server Action transition. */
  const acquireLock = useCallback(async (): Promise<boolean> => {
    return new Promise((resolve) => {
      startLockTransition(() => {
        void mutation.execute(async () => {
          const result = await acquireLockAction(resourceType, resourceId);
          if (!result.success) throw result.details;

          // The server action is authoritative. The session returned here can be
          // available before the client session provider finishes synchronizing.
          setAcquiredSessionId(result.lock.sessionId);
          setAcquiredLockId(result.lock.id);
          acquiredLockIdRef.current = result.lock.id;
          rememberBrowserLock({ resourceType, resourceId }, result.lock.sessionId, result.lock.id);
          ownsLockRef.current = true;
          AppCache.setLockState(resourceType, resourceId, {
            locked: true,
            byUserId: currentUserId,
            bySessionId: result.lock.sessionId,
            expiresAt: result.lock.expiresAt,
          });
        }, undefined, { notifySuccess: false }).then((outcome) => resolve(outcome.ok));
      });
    });
  }, [currentUserId, mutation, resourceId, resourceType, startLockTransition]);

  /** Releases an owned lock through the same Server Action boundary used for acquisition. */
  const releaseLock = useCallback(async (): Promise<void> => {
    cancelScheduledLockRelease({ resourceType, resourceId });
    // Explicit release is a server command, not a cache decision. A delayed
    // read-model/realtime snapshot may temporarily hide our persisted lock.
    await new Promise<void>((resolve) => {
      startLockTransition(() => {
        void mutation.execute(async () => {
          const lockId = acquiredLockId ?? getRememberedBrowserLock({ resourceType, resourceId })?.lockId;
          const result = lockId
            ? await releaseLockAction(resourceType, resourceId, lockId)
            : await releaseLockAction(resourceType, resourceId);
          if (!result.success) throw result.details;

          setAcquiredSessionId(undefined);
          setAcquiredLockId(undefined);
          acquiredLockIdRef.current = undefined;
          forgetBrowserLock({ resourceType, resourceId });
          AppCache.setLockState(resourceType, resourceId, { locked: false });
        }, undefined, { notifySuccess: false }).then(() => resolve());
      });
    });
  }, [acquiredLockId, mutation, resourceId, resourceType, startLockTransition]);

  useEffect(() => {
    void AppCache.hydrateLockState(resourceType, resourceId);
  }, [resourceId, resourceType]);

  const isMyLock = useMemo(
    () => isOwnedLock(
      lockState,
      currentSessionId,
      acquiredSessionId ?? getRememberedBrowserLock({ resourceType, resourceId })?.sessionId,
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
      releaseLockThroughApi({ resourceType, resourceId }, true, acquiredLockIdRef.current ?? getRememberedBrowserLock({ resourceType, resourceId })?.lockId);
      ownsLockRef.current = false;
    };

    window.addEventListener('pagehide', releaseOnPageExit);
    return () => {
      window.removeEventListener('pagehide', releaseOnPageExit);
      if (ownsLockRef.current) {
        ownsLockRef.current = false;
        const lockId = acquiredLockIdRef.current ?? getRememberedBrowserLock({ resourceType, resourceId })?.lockId;
        scheduleLockRelease(
          { resourceType, resourceId },
          () => {
            forgetBrowserLock({ resourceType, resourceId }, lockId);
            releaseLockThroughApi({ resourceType, resourceId }, false, lockId);
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
    error: mutation.failure?.message ?? null,
    mutationFailure: mutation.failure,
    retryMutation: () => void mutation.retry(),
    acquireLock,
    releaseLock,
  };
}
