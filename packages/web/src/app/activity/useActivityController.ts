'use client';

import { useCallback, useReducer, useRef } from 'react';
import { AppCache } from '../cache/GlobalCacheClient';
import { activityDebugStore } from './ActivityDebugStore';
import { requestActivity, type ActivityResponse, type SessionCheckResult } from './activityProtocol';
import { ActiveLockRegistry, ActivityHeartbeatGate, lockKey } from './activityRuntime';
import { initialActivityState, reduceActivityState } from './activityState';
import type { ActivityChannelMessage, ActivityLockRef } from './activityTypes';

interface ActivityControllerOptions {
  initialExpires?: string;
  userId?: string;
  sessionId?: string;
  publish(message: ActivityChannelMessage): void;
}

export function useActivityController({ initialExpires, userId, sessionId, publish }: ActivityControllerOptions) {
  const [state, dispatch] = useReducer(reduceActivityState, initialExpires, initialActivityState);
  const heartbeatGateRef = useRef(new ActivityHeartbeatGate());
  const activeLocksRef = useRef(new ActiveLockRegistry());
  const identityRef = useRef<string | undefined>(undefined);

  const adoptExpiry = useCallback((expiresAt: string, broadcast = true) => {
    dispatch({ type: 'renewed', expiresAt });
    if (broadcast) publish({ type: 'renewed', expiresAt });
  }, [publish]);

  const markExpired = useCallback(() => {
    heartbeatGateRef.current.reset();
    dispatch({ type: 'expired' });
    AppCache.purgeAll();
    activityDebugStore.sessionExpired();
    publish({ type: 'expired' });
  }, [publish]);

  const adoptRemoteExpiration = useCallback(() => {
    heartbeatGateRef.current.reset();
    dispatch({ type: 'expired' });
    AppCache.purgeAll();
  }, []);

  const adoptRemoteExpiry = useCallback((expiresAt: string) => {
    adoptExpiry(expiresAt, false);
    activityDebugStore.sessionRenewed(expiresAt, 'broadcast');
  }, [adoptExpiry]);

  const adoptTiming = useCallback((timing: ActivityResponse['timing']) => {
    dispatch({ type: 'timing-received', timing });
  }, []);

  const resetForLogout = useCallback(() => {
    identityRef.current = undefined;
    heartbeatGateRef.current.reset();
    activeLocksRef.current.clear();
    dispatch({ type: 'logged-out' });
    AppCache.purgeAll();
    activityDebugStore.resetForLogout();
  }, []);

  const authenticate = useCallback(() => {
    const identity = userId && sessionId ? `${userId}:${sessionId}` : userId;
    if (identityRef.current && identityRef.current !== identity) {
      heartbeatGateRef.current.reset();
      activeLocksRef.current.clear();
      dispatch({ type: 'logged-out' });
      AppCache.purgeAll();
    }
    identityRef.current = identity;
    dispatch({ type: 'authenticated' });
  }, [sessionId, userId]);

  const checkSession = useCallback(async (): Promise<SessionCheckResult> => {
    const requestGeneration = heartbeatGateRef.current.captureGeneration();
    const request = await requestActivity('/api/activity', { method: 'GET', cache: 'no-store' });
    if (!heartbeatGateRef.current.isGenerationCurrent(requestGeneration)) return 'unreachable';
    if (request.outcome === 'expired') {
      markExpired();
      return 'expired';
    }
    if (request.outcome === 'unreachable') {
      activityDebugStore.sessionChecked(request.response ? 'server-error' : 'network-error');
      return 'unreachable';
    }
    try {
      const result = await request.response.json() as { sessionExpiresAt: string; timing?: ActivityResponse['timing'] };
      if (!heartbeatGateRef.current.isGenerationCurrent(requestGeneration)) return 'unreachable';
      adoptExpiry(result.sessionExpiresAt);
      adoptTiming(result.timing);
      activityDebugStore.sessionChecked('success', result.sessionExpiresAt);
      return 'valid';
    } catch {
      activityDebugStore.sessionChecked('server-error');
      return 'unreachable';
    }
  }, [adoptExpiry, adoptTiming, markExpired]);

  const sendHeartbeat = useCallback(async () => {
    if (!userId || state.isSessionExpired) return;
    const token = heartbeatGateRef.current.start(Date.now(), state.timing.activityHeartbeatThrottleMs);
    if (!token) {
      activityDebugStore.heartbeatThrottled();
      return;
    }

    const activeLocks = activeLocksRef.current.values();
    const startedAt = performance.now();
    activityDebugStore.heartbeatStarted(activeLocks.length);
    try {
      const request = await requestActivity('/api/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeLocks }),
      });
      if (!heartbeatGateRef.current.isCurrent(token)) return;
      if (request.outcome === 'expired') {
        activityDebugStore.heartbeatFinished('unauthorized', performance.now() - startedAt, undefined, 0, request.response.status);
        markExpired();
        return;
      }
      if (request.outcome === 'unreachable') {
        activityDebugStore.heartbeatFinished(
          request.response ? 'server-error' : 'network-error',
          performance.now() - startedAt,
          undefined,
          0,
          request.response?.status,
        );
        return;
      }

      const result = await request.response.json() as ActivityResponse;
      if (!heartbeatGateRef.current.isCurrent(token)) return;
      adoptExpiry(result.sessionExpiresAt);
      adoptTiming(result.timing);
      activityDebugStore.sessionRenewed(result.sessionExpiresAt, 'heartbeat');
      activityDebugStore.heartbeatFinished(
        'success',
        performance.now() - startedAt,
        result.sessionExpiresAt,
        result.renewedLocks.length,
        request.response.status,
      );

      const renewedKeys = new Set(result.renewedLocks.map(lockKey));
      for (const lock of activeLocks) {
        if (!renewedKeys.has(lockKey(lock))) AppCache.setLockState(lock.resourceType, lock.resourceId, { locked: false });
      }
      for (const lock of result.renewedLocks) {
        AppCache.setLockState(lock.resourceType, lock.resourceId, {
          locked: true,
          byUserId: userId,
          bySessionId: sessionId,
          expiresAt: lock.expiresAt,
        });
      }
    } catch {
      if (heartbeatGateRef.current.isCurrent(token)) {
        activityDebugStore.heartbeatFinished('server-error', performance.now() - startedAt);
      }
    } finally {
      heartbeatGateRef.current.finish(token);
    }
  }, [adoptExpiry, adoptTiming, markExpired, sessionId, state.isSessionExpired, state.timing.activityHeartbeatThrottleMs, userId]);

  const registerActiveLock = useCallback((lock: ActivityLockRef) => {
    const unregister = activeLocksRef.current.register(lock);
    activityDebugStore.lockRegistered(lock);
    return () => {
      if (unregister()) activityDebugStore.lockUnregistered(lock);
    };
  }, []);

  return {
    ...state,
    adoptRemoteExpiration,
    adoptRemoteExpiry,
    authenticate,
    checkSession,
    registerActiveLock,
    resetForLogout,
    sendHeartbeat,
  };
}
