'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSession } from 'next-auth/react';
import { runtimeTiming } from '../../config/runtimeTiming';
import { AppCache } from '../cache/GlobalCacheClient';
import { activityDebugStore } from './ActivityDebugStore';

export interface ActivityLockRef {
  resourceType: 'node' | 'entity';
  resourceId: string;
}

type SessionCheckResult = 'valid' | 'expired' | 'unreachable';

interface ActivityContextValue {
  sessionExpiresAt?: string;
  isSessionExpired: boolean;
  timing: typeof runtimeTiming;
  registerActiveLock(lock: ActivityLockRef): () => void;
  checkSession(): Promise<SessionCheckResult>;
}

const ActivityContext = createContext<ActivityContextValue | null>(null);
const ACTIVITY_CHANNEL = 'dashboard-human-activity';

interface ActivityResponse {
  sessionExpiresAt: string;
  renewedLocks: Array<ActivityLockRef & { expiresAt: string }>;
  timing?: {
    sessionIdleTimeoutSeconds: number;
    sessionUpdateAgeSeconds: number;
    lockTtlSeconds: number;
    syncPollingIntervalSeconds: number;
  };
}

function toClientTiming(value: ActivityResponse['timing']): typeof runtimeTiming {
  if (!value) return runtimeTiming;
  return {
    ...runtimeTiming,
    sessionIdleTimeoutSeconds: value.sessionIdleTimeoutSeconds,
    sessionIdleTimeoutMs: value.sessionIdleTimeoutSeconds * 1000,
    sessionUpdateAgeSeconds: value.sessionUpdateAgeSeconds,
    lockTtlSeconds: value.lockTtlSeconds,
    activityHeartbeatThrottleMs: value.sessionUpdateAgeSeconds * 1000,
    syncPollingIntervalMs: value.syncPollingIntervalSeconds * 1000,
  };
}

function isLoginRedirect(response: Response): boolean {
  if (!response.redirected) return false;
  try {
    return new URL(response.url).pathname === '/login';
  } catch {
    return false;
  }
}

export function ActivityProvider({
  children,
  initialExpires,
}: {
  children: React.ReactNode;
  initialExpires?: string;
}) {
  const { data: session } = useSession();
  const userId = session?.userId;
  const sessionId = session?.activitySessionId;
  const [sessionExpiresAt, setSessionExpiresAt] = useState(initialExpires);
  const [timing, setTiming] = useState<typeof runtimeTiming>(runtimeTiming);
  const [isSessionExpired, setSessionExpired] = useState(false);
  const activeLocksRef = useRef(new Map<string, ActivityLockRef>());
  const lastHeartbeatAtRef = useRef(0);
  const heartbeatInFlightRef = useRef(false);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const adoptExpiry = useCallback((expiresAt: string, broadcast = true) => {
    setSessionExpiresAt(expiresAt);
    setSessionExpired(false);
    if (broadcast) channelRef.current?.postMessage({ type: 'renewed', expiresAt });
  }, []);

  const markExpired = useCallback(() => {
    setSessionExpired(true);
    AppCache.purgeAll();
    activityDebugStore.sessionExpired();
    channelRef.current?.postMessage({ type: 'expired' });
  }, []);

  const adoptTiming = useCallback((serverTiming: ActivityResponse['timing']) => {
    if (!serverTiming) return;
    const next = toClientTiming(serverTiming);
    setTiming((current) => (
      current.sessionIdleTimeoutSeconds === next.sessionIdleTimeoutSeconds
      && current.sessionUpdateAgeSeconds === next.sessionUpdateAgeSeconds
      && current.lockTtlSeconds === next.lockTtlSeconds
      && current.syncPollingIntervalMs === next.syncPollingIntervalMs
        ? current
        : next
    ));
  }, []);

  const checkSession = useCallback(async (): Promise<SessionCheckResult> => {
    try {
      const response = await fetch('/api/activity', {
        method: 'GET',
        cache: 'no-store',
      });
      if (response.status === 401 || isLoginRedirect(response)) {
        markExpired();
        return 'expired';
      }
      if (!response.ok) {
        activityDebugStore.sessionChecked('server-error');
        return 'unreachable';
      }
      const result = await response.json() as { sessionExpiresAt: string; timing?: ActivityResponse['timing'] };
      adoptExpiry(result.sessionExpiresAt);
      adoptTiming(result.timing);
      activityDebugStore.sessionChecked('success', result.sessionExpiresAt);
      return 'valid';
    } catch {
      activityDebugStore.sessionChecked('network-error');
      return 'unreachable';
    }
  }, [adoptExpiry, adoptTiming, markExpired]);

  const sendHeartbeat = useCallback(async () => {
    if (!userId || isSessionExpired || document.visibilityState !== 'visible') return;
    const now = Date.now();
    const nextAllowedAt = lastHeartbeatAtRef.current + timing.activityHeartbeatThrottleMs;
    if (heartbeatInFlightRef.current || now < nextAllowedAt) {
      activityDebugStore.heartbeatThrottled();
      return;
    }

    lastHeartbeatAtRef.current = now;
    heartbeatInFlightRef.current = true;
    const activeLocks = [...activeLocksRef.current.values()];
    const startedAt = performance.now();
    activityDebugStore.heartbeatStarted(activeLocks.length);
    try {
      const response = await fetch('/api/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeLocks }),
      });
      if (response.status === 401 || isLoginRedirect(response)) {
        activityDebugStore.heartbeatFinished('unauthorized', performance.now() - startedAt, undefined, 0, response.status);
        markExpired();
        return;
      }
      if (!response.ok) {
        activityDebugStore.heartbeatFinished('server-error', performance.now() - startedAt, undefined, 0, response.status);
        return;
      }
      const result = await response.json() as ActivityResponse;
      adoptExpiry(result.sessionExpiresAt);
      adoptTiming(result.timing);
      activityDebugStore.sessionRenewed(result.sessionExpiresAt, 'heartbeat');
      activityDebugStore.heartbeatFinished(
        'success',
        performance.now() - startedAt,
        result.sessionExpiresAt,
        result.renewedLocks.length,
        response.status,
      );

      const renewedKeys = new Set(result.renewedLocks.map(
        (lock) => `${lock.resourceType}:${lock.resourceId}`,
      ));
      for (const lock of activeLocks) {
        const key = `${lock.resourceType}:${lock.resourceId}`;
        if (!renewedKeys.has(key)) {
          AppCache.setLockState(lock.resourceType, lock.resourceId, { locked: false });
        }
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
      // A transient network failure is not proof of session expiry. The next
      // genuine interaction or the passive status check will retry.
      activityDebugStore.heartbeatFinished('network-error', performance.now() - startedAt);
    } finally {
      heartbeatInFlightRef.current = false;
    }
  }, [adoptExpiry, adoptTiming, isSessionExpired, markExpired, sessionId, timing.activityHeartbeatThrottleMs, userId]);

  const registerActiveLock = useCallback((lock: ActivityLockRef) => {
    const key = `${lock.resourceType}:${lock.resourceId}`;
    activeLocksRef.current.set(key, lock);
    activityDebugStore.lockRegistered(lock);
    return () => {
      activeLocksRef.current.delete(key);
      activityDebugStore.lockUnregistered(lock);
    };
  }, []);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(ACTIVITY_CHANNEL);
    channelRef.current = channel;
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (!event.data || typeof event.data !== 'object') return;
      const type = Reflect.get(event.data, 'type');
      const expiresAt = Reflect.get(event.data, 'expiresAt');
      if (type === 'renewed' && typeof expiresAt === 'string') {
        adoptExpiry(expiresAt, false);
        activityDebugStore.sessionRenewed(expiresAt, 'broadcast');
      }
      if (type === 'expired') {
        setSessionExpired(true);
        AppCache.purgeAll();
      }
    };
    return () => {
      channelRef.current = null;
      channel.close();
    };
  }, [adoptExpiry]);

  useEffect(() => {
    if (!userId || isSessionExpired) return;
    const activity = (event: Event) => {
      activityDebugStore.activityDetected(event.type);
      void sendHeartbeat();
    };
    document.addEventListener('pointerdown', activity, true);
    document.addEventListener('keydown', activity, true);
    document.addEventListener('input', activity, true);
    document.addEventListener('wheel', activity, true);
    return () => {
      document.removeEventListener('pointerdown', activity, true);
      document.removeEventListener('keydown', activity, true);
      document.removeEventListener('input', activity, true);
      document.removeEventListener('wheel', activity, true);
    };
  }, [isSessionExpired, sendHeartbeat, userId]);

  useEffect(() => {
    activityDebugStore.setAuthenticated(Boolean(userId));
  }, [userId]);

  useEffect(() => {
    const validateWhenVisible = () => {
      activityDebugStore.setVisibility(document.visibilityState);
      if (document.visibilityState === 'visible' && userId && !isSessionExpired) void checkSession();
    };
    document.addEventListener('visibilitychange', validateWhenVisible);
    validateWhenVisible();
    return () => document.removeEventListener('visibilitychange', validateWhenVisible);
  }, [checkSession, isSessionExpired, userId]);

  const value = useMemo<ActivityContextValue>(() => ({
    sessionExpiresAt,
    isSessionExpired,
    timing,
    registerActiveLock,
    checkSession,
  }), [checkSession, isSessionExpired, registerActiveLock, sessionExpiresAt, timing]);

  return <ActivityContext.Provider value={value}>{children}</ActivityContext.Provider>;
}

export function useHumanActivity(): ActivityContextValue {
  const context = useContext(ActivityContext);
  if (!context) throw new Error('useHumanActivity must be used within ActivityProvider');
  return context;
}
