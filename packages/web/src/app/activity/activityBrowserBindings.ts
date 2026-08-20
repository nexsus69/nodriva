'use client';

import { useEffect, type RefObject } from 'react';
import { activityDebugStore } from './ActivityDebugStore';
import type { ActivityChannelMessage } from './activityTypes';

export const ACTIVITY_CHANNEL = 'dashboard-human-activity';
export const HUMAN_ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'input', 'wheel'] as const;

interface BrowserEventTarget {
  addEventListener(type: string, listener: EventListener, options?: boolean | AddEventListenerOptions): void;
  removeEventListener(type: string, listener: EventListener, options?: boolean | EventListenerOptions): void;
}

interface VisibilityTarget extends BrowserEventTarget {
  readonly visibilityState: DocumentVisibilityState;
}

export function bindHumanActivity(target: BrowserEventTarget, listener: EventListener): () => void {
  for (const eventName of HUMAN_ACTIVITY_EVENTS) target.addEventListener(eventName, listener, true);
  return () => {
    for (const eventName of HUMAN_ACTIVITY_EVENTS) target.removeEventListener(eventName, listener, true);
  };
}

export function bindVisibility(target: VisibilityTarget, listener: (visibility: DocumentVisibilityState) => void): () => void {
  const handleVisibility = () => listener(target.visibilityState);
  target.addEventListener('visibilitychange', handleVisibility);
  handleVisibility();
  return () => target.removeEventListener('visibilitychange', handleVisibility);
}

export function parseActivityChannelMessage(value: unknown): ActivityChannelMessage | null {
  if (!value || typeof value !== 'object') return null;
  const type = Reflect.get(value, 'type');
  if (type === 'expired') return { type };
  const expiresAt = Reflect.get(value, 'expiresAt');
  return type === 'renewed' && typeof expiresAt === 'string' ? { type, expiresAt } : null;
}

interface ActivityBrowserBindingsOptions {
  channelRef: RefObject<BroadcastChannel | null>;
  sessionStatus: 'loading' | 'authenticated' | 'unauthenticated';
  userId?: string;
  sessionId?: string;
  isSessionExpired: boolean;
  adoptRemoteExpiry(expiresAt: string): void;
  adoptRemoteExpiration(): void;
  authenticate(): void;
  resetForLogout(): void;
  checkSession(): Promise<unknown>;
  sendHeartbeat(): Promise<void>;
}

export function useActivityBrowserBindings({
  channelRef,
  sessionStatus,
  userId,
  sessionId,
  isSessionExpired,
  adoptRemoteExpiry,
  adoptRemoteExpiration,
  authenticate,
  resetForLogout,
  checkSession,
  sendHeartbeat,
}: ActivityBrowserBindingsOptions): void {
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(ACTIVITY_CHANNEL);
    channelRef.current = channel;
    channel.onmessage = (event: MessageEvent<unknown>) => {
      const message = parseActivityChannelMessage(event.data);
      if (message?.type === 'renewed') adoptRemoteExpiry(message.expiresAt);
      if (message?.type === 'expired') adoptRemoteExpiration();
    };
    return () => {
      if (channelRef.current === channel) channelRef.current = null;
      channel.close();
    };
  }, [adoptRemoteExpiration, adoptRemoteExpiry, channelRef]);

  useEffect(() => {
    if (!userId || isSessionExpired) return;
    return bindHumanActivity(document, (event) => {
      activityDebugStore.activityDetected(event.type);
      if (document.visibilityState === 'visible') void sendHeartbeat();
    });
  }, [isSessionExpired, sendHeartbeat, userId]);

  useEffect(() => {
    if (sessionStatus !== 'authenticated' || !userId) {
      const resetTimer = window.setTimeout(resetForLogout, 0);
      return () => window.clearTimeout(resetTimer);
    }
    const activateTimer = window.setTimeout(authenticate, 0);
    activityDebugStore.setAuthenticated(true);
    return () => window.clearTimeout(activateTimer);
  }, [authenticate, resetForLogout, sessionId, sessionStatus, userId]);

  useEffect(() => bindVisibility(document, (visibility) => {
    activityDebugStore.setVisibility(visibility);
    if (visibility === 'visible' && userId && !isSessionExpired) void checkSession();
  }), [checkSession, isSessionExpired, sessionId, userId]);
}
