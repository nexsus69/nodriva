'use client';

import Pusher, { Channel } from 'pusher-js';
import type { RealtimeDataChangedEvent, RealtimeResourceType } from '@dashboard/core';

type RealtimeListener = (event: RealtimeDataChangedEvent) => void;

export interface RealtimeDebugEvent {
  id: string;
  channelName: string;
  eventName: string;
  receivedAt: string;
  payload: unknown;
}

export type RealtimeDebugListener = (event: RealtimeDebugEvent) => void;

let debugEventSequence = 0;

export interface LockChannelEvent {
  resourceType: RealtimeResourceType;
  resourceId: string;
  userId?: string;
  sessionId?: string;
  expiresAt?: string;
}

type LockListener = (
  eventName: 'lock:acquired' | 'lock:released' | 'lock:force-released',
  event: LockChannelEvent
) => void;

interface ChannelState {
  channel: Channel;
  listeners: Set<RealtimeListener>;
}

interface LockChannelState {
  channel: Channel;
  listeners: Set<LockListener>;
}

export class RealtimeCacheBridge {
  private pusher: Pusher | null = null;
  private readonly channels = new Map<string, ChannelState>();
  private readonly lockChannels = new Map<string, LockChannelState>();
  private readonly handledEventIds = new Set<string>();
  private scopeRelease: (() => void) | null = null;

  constructor(
    private readonly onEvent: RealtimeListener,
    private readonly onLockEvent?: LockListener,
    private readonly onDebugEvent?: RealtimeDebugListener
  ) {}

  private emitDebugEvent(channelName: string, eventName: string, payload: unknown): void {
    try {
      this.onDebugEvent?.({
        id: `${Date.now()}-${debugEventSequence++}`,
        channelName,
        eventName,
        receivedAt: new Date().toISOString(),
        payload,
      });
    } catch (error) {
      console.error('[RealtimeCacheBridge] Debug listener failed:', error);
    }
  }

  private retainDataChannel(channelName: string, listener: RealtimeListener = () => undefined): () => void {
    let state = this.channels.get(channelName);

    if (!state) {
      const pusher = this.getPusher();
      if (!pusher) return () => undefined;

      const channel = pusher.subscribe(channelName);
      const handleEvent = (event: RealtimeDataChangedEvent) => {
        this.emitDebugEvent(channelName, 'data:changed', event);
        if (this.handledEventIds.has(event.eventId)) return;
        this.handledEventIds.add(event.eventId);
        if (this.handledEventIds.size > 1000) {
          const oldestEventId = this.handledEventIds.values().next().value;
          if (oldestEventId) this.handledEventIds.delete(oldestEventId);
        }

        try {
          this.onEvent(event);
        } catch (error) {
          console.error('[RealtimeCacheBridge] Failed to apply event:', error);
        }

        this.channels.get(channelName)?.listeners.forEach((subscriber) => {
          try {
            subscriber(event);
          } catch (error) {
            console.error('[RealtimeCacheBridge] Realtime listener failed:', error);
          }
        });
      };
      channel.bind('data:changed', handleEvent);
      channel.bind('pusher:subscription_error', (status: unknown) => {
        this.emitDebugEvent(channelName, 'pusher:subscription_error', status);
        let details: string;
        try {
          details = JSON.stringify(status);
        } catch {
          details = String(status);
        }
        console.error(
          `[RealtimeCacheBridge] Subscription failed for ${channelName}: ${details}`
        );
      });
      state = { channel, listeners: new Set() };
      this.channels.set(channelName, state);
    }

    state.listeners.add(listener);

    return () => {
      const current = this.channels.get(channelName);
      if (!current) return;
      current.listeners.delete(listener);
      if (current.listeners.size > 0) return;

      current.channel.unbind('data:changed');
      this.pusher?.unsubscribe(channelName);
      this.channels.delete(channelName);
      this.disconnectIfUnused();
    };
  }

  private retainLockChannel(channelName: string, listener: LockListener = () => undefined): () => void {
    let state = this.lockChannels.get(channelName);

    if (!state) {
      const pusher = this.getPusher();
      if (!pusher) return () => undefined;

      const channel = pusher.subscribe(channelName);
      const bind = (eventName: 'lock:acquired' | 'lock:released' | 'lock:force-released') => {
        channel.bind(eventName, (event: LockChannelEvent) => {
          this.emitDebugEvent(channelName, eventName, event);
          this.lockChannels.get(channelName)?.listeners.forEach((subscriber) => {
            try {
              subscriber(eventName, event);
            } catch (error) {
              console.error('[RealtimeCacheBridge] Lock listener failed:', error);
            }
          });
        });
      };
      bind('lock:acquired');
      bind('lock:released');
      bind('lock:force-released');
      channel.bind('pusher:subscription_error', (status: unknown) => {
        this.emitDebugEvent(channelName, 'pusher:subscription_error', status);
        console.error(`[RealtimeCacheBridge] Lock subscription failed for ${channelName}:`, status);
      });
      state = { channel, listeners: new Set() };
      this.lockChannels.set(channelName, state);
    }

    state.listeners.add(listener);
    return () => {
      const current = this.lockChannels.get(channelName);
      if (!current) return;
      current.listeners.delete(listener);
      if (current.listeners.size > 0) return;
      current.channel.unbind_all();
      this.pusher?.unsubscribe(channelName);
      this.lockChannels.delete(channelName);
      this.disconnectIfUnused();
    };
  }

  retainPolicyChannels(dataChannels: string[], lockChannels: string[]): () => void {
    this.scopeRelease?.();
    const releases = [
      ...dataChannels.map((channelName) => this.retainDataChannel(channelName)),
      ...lockChannels.map((channelName) => this.retainLockChannel(channelName, this.onLockEvent)),
    ];
    this.scopeRelease = () => {
      releases.forEach((release) => release());
      this.scopeRelease = null;
      this.disconnectIfUnused();
    };
    return this.scopeRelease;
  }

  private disconnectIfUnused(): void {
    if (this.channels.size === 0 && this.lockChannels.size === 0) {
      this.pusher?.disconnect();
      this.pusher = null;
    }
  }

  private getPusher(): Pusher | null {
    if (this.pusher) return this.pusher;
    if (process.env.NEXT_PUBLIC_REALTIME_ENABLED === 'false') return null;

    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    if (!key) return null;

    this.pusher = new Pusher(key, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'mt1',
      wsHost: process.env.NEXT_PUBLIC_PUSHER_HOST,
      wsPort: process.env.NEXT_PUBLIC_PUSHER_PORT
        ? Number.parseInt(process.env.NEXT_PUBLIC_PUSHER_PORT, 10)
        : undefined,
      forceTLS: process.env.NEXT_PUBLIC_PUSHER_SCHEME === 'https',
      enableStats: false,
      enabledTransports: ['ws', 'wss'],
      userAuthentication: {
        endpoint: '/api/pusher/user-auth',
        transport: 'ajax',
      },
      channelAuthorization: {
        endpoint: '/api/pusher/auth',
        transport: 'ajax',
      },
    });

    // Keep the bridge testable with minimal Pusher-compatible clients while
    // authenticating real SDK connections for server-side revocation.
    this.pusher.signin?.();

    this.pusher.connection.bind('error', (error: unknown) => {
      this.emitDebugEvent('__pusher_connection__', 'pusher:connection_error', error);
      console.error('[RealtimeCacheBridge] Pusher connection error:', error);
    });

    return this.pusher;
  }
}
