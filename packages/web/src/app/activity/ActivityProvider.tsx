'use client';

import { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { runtimeTiming } from '../../config/runtimeTiming';
import { useActivityBrowserBindings } from './activityBrowserBindings';
import type { SessionCheckResult } from './activityProtocol';
import type { ActivityChannelMessage, ActivityLockRef } from './activityTypes';
import { useActivityController } from './useActivityController';

export type { ActivityLockRef } from './activityTypes';

interface ActivityContextValue {
  sessionExpiresAt?: string;
  isSessionExpired: boolean;
  timing: typeof runtimeTiming;
  registerActiveLock(lock: ActivityLockRef): () => void;
  checkSession(): Promise<SessionCheckResult>;
  resetActivity(): void;
}

const ActivityContext = createContext<ActivityContextValue | null>(null);

export function ActivityProvider({ children, initialExpires }: { children: React.ReactNode; initialExpires?: string }) {
  const { data: session, status: sessionStatus } = useSession();
  const channelRef = useRef<BroadcastChannel | null>(null);
  const publish = useCallback((message: ActivityChannelMessage) => channelRef.current?.postMessage(message), []);
  const controller = useActivityController({
    initialExpires,
    userId: session?.userId,
    sessionId: session?.activitySessionId,
    publish,
  });
  const {
    sessionExpiresAt,
    isSessionExpired,
    timing,
    registerActiveLock,
    checkSession,
    resetForLogout,
  } = controller;

  useActivityBrowserBindings({
    channelRef,
    sessionStatus,
    userId: session?.userId,
    sessionId: session?.activitySessionId,
    isSessionExpired: controller.isSessionExpired,
    adoptRemoteExpiry: controller.adoptRemoteExpiry,
    adoptRemoteExpiration: controller.adoptRemoteExpiration,
    authenticate: controller.authenticate,
    resetForLogout: controller.resetForLogout,
    checkSession: controller.checkSession,
    sendHeartbeat: controller.sendHeartbeat,
  });

  const value = useMemo<ActivityContextValue>(() => ({
    sessionExpiresAt,
    isSessionExpired,
    timing,
    registerActiveLock,
    checkSession,
    resetActivity: resetForLogout,
  }), [checkSession, isSessionExpired, registerActiveLock, resetForLogout, sessionExpiresAt, timing]);

  return <ActivityContext.Provider value={value}>{children}</ActivityContext.Provider>;
}

export function useHumanActivity(): ActivityContextValue {
  const context = useContext(ActivityContext);
  if (!context) throw new Error('useHumanActivity must be used within ActivityProvider');
  return context;
}
