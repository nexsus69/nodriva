'use client';

import type { ActivityLockRef } from './ActivityProvider';

export type DebugOutcome = 'idle' | 'running' | 'success' | 'unauthorized' | 'network-error' | 'server-error';

export interface ActivityDebugEvent {
  id: number;
  occurredAt: string;
  category: 'activity' | 'heartbeat' | 'session' | 'lock' | 'sync' | 'visibility';
  outcome: DebugOutcome;
  message: string;
}

export interface ActivityDebugSnapshot {
  pageVisibility: DocumentVisibilityState | 'unknown';
  authenticated: boolean;
  sessionExpiresAt?: string;
  lastHumanActivityAt?: string;
  lastHumanActivityType?: string;
  humanActivityCount: number;
  heartbeatCount: number;
  heartbeatThrottledCount: number;
  heartbeatStatus: DebugOutcome;
  lastHeartbeatAt?: string;
  lastHeartbeatDurationMs?: number;
  activeLocks: ActivityLockRef[];
  renewedLockCount: number;
  syncCount: number;
  syncStatus: DebugOutcome;
  lastSyncAt?: string;
  lastSyncDurationMs?: number;
  dataChannelCount: number;
  lockChannelCount: number;
  virtualRootCount: number;
  events: ActivityDebugEvent[];
}

const EVENT_LIMIT = 150;
const SERVER_SNAPSHOT: ActivityDebugSnapshot = {
  pageVisibility: 'unknown',
  authenticated: false,
  humanActivityCount: 0,
  heartbeatCount: 0,
  heartbeatThrottledCount: 0,
  heartbeatStatus: 'idle',
  activeLocks: [],
  renewedLockCount: 0,
  syncCount: 0,
  syncStatus: 'idle',
  dataChannelCount: 0,
  lockChannelCount: 0,
  virtualRootCount: 0,
  events: [],
};

class ActivityDebugStore {
  private sequence = 0;
  private snapshot: ActivityDebugSnapshot = {
    ...SERVER_SNAPSHOT,
    pageVisibility: typeof document === 'undefined' ? 'unknown' : document.visibilityState,
  };
  private readonly subscribers = new Set<() => void>();

  getSnapshot = (): ActivityDebugSnapshot => this.snapshot;
  getServerSnapshot = (): ActivityDebugSnapshot => SERVER_SNAPSHOT;

  subscribe = (subscriber: () => void): (() => void) => {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  };

  clearEvents = (): void => this.update({ events: [] });

  setAuthenticated(authenticated: boolean): void {
    this.update({ authenticated });
  }

  setVisibility(visibility: DocumentVisibilityState): void {
    this.update({ pageVisibility: visibility });
    this.event('visibility', 'success', `Pagina ${visibility}`);
  }

  activityDetected(type: string): void {
    const occurredAt = new Date().toISOString();
    this.update({
      lastHumanActivityAt: occurredAt,
      lastHumanActivityType: type,
      humanActivityCount: this.snapshot.humanActivityCount + 1,
    });
  }

  heartbeatThrottled(): void {
    this.update({
      heartbeatThrottledCount: this.snapshot.heartbeatThrottledCount + 1,
    });
  }

  heartbeatStarted(lockCount: number): void {
    this.update({
      heartbeatCount: this.snapshot.heartbeatCount + 1,
      heartbeatStatus: 'running',
      lastHeartbeatAt: new Date().toISOString(),
    });
    this.event('heartbeat', 'running', `Heartbeat avviato (${lockCount} lock)`);
  }

  heartbeatFinished(
    outcome: Exclude<DebugOutcome, 'idle' | 'running'>,
    durationMs: number,
    sessionExpiresAt?: string,
    renewedLockCount = 0,
    httpStatus?: number,
  ): void {
    this.update({
      heartbeatStatus: outcome,
      lastHeartbeatDurationMs: Math.round(durationMs),
      sessionExpiresAt: sessionExpiresAt ?? this.snapshot.sessionExpiresAt,
      renewedLockCount,
    });
    const status = httpStatus ? ` · HTTP ${httpStatus}` : '';
    this.event('heartbeat', outcome, `Heartbeat ${outcome} in ${Math.round(durationMs)} ms${status}`);
  }

  sessionChecked(outcome: Exclude<DebugOutcome, 'idle' | 'running'>, expiresAt?: string): void {
    this.update({ sessionExpiresAt: expiresAt ?? this.snapshot.sessionExpiresAt });
    this.event('session', outcome, expiresAt ? `Sessione valida fino a ${expiresAt}` : `Sessione ${outcome}`);
  }

  sessionRenewed(expiresAt: string, source: 'heartbeat' | 'broadcast'): void {
    this.update({ sessionExpiresAt: expiresAt });
    if (source === 'broadcast') this.event('session', 'success', 'Scadenza ricevuta da un’altra scheda');
  }

  sessionExpired(): void {
    this.event('session', 'unauthorized', 'Sessione scaduta');
  }

  lockRegistered(lock: ActivityLockRef): void {
    const key = `${lock.resourceType}:${lock.resourceId}`;
    const activeLocks = [...this.snapshot.activeLocks.filter(
      (item) => `${item.resourceType}:${item.resourceId}` !== key,
    ), lock];
    this.update({ activeLocks });
    this.event('lock', 'success', `Registrato ${key}`);
  }

  lockUnregistered(lock: ActivityLockRef): void {
    const key = `${lock.resourceType}:${lock.resourceId}`;
    this.update({
      activeLocks: this.snapshot.activeLocks.filter(
        (item) => `${item.resourceType}:${item.resourceId}` !== key,
      ),
    });
    this.event('lock', 'success', `Rimosso ${key}`);
  }

  syncStarted(): void {
    this.update({ syncCount: this.snapshot.syncCount + 1, syncStatus: 'running' });
  }

  syncFinished(
    outcome: Exclude<DebugOutcome, 'idle' | 'running'>,
    durationMs: number,
    counts?: { dataChannels: number; lockChannels: number; virtualRoots: number },
  ): void {
    this.update({
      syncStatus: outcome,
      lastSyncAt: new Date().toISOString(),
      lastSyncDurationMs: Math.round(durationMs),
      dataChannelCount: counts?.dataChannels ?? this.snapshot.dataChannelCount,
      lockChannelCount: counts?.lockChannels ?? this.snapshot.lockChannelCount,
      virtualRootCount: counts?.virtualRoots ?? this.snapshot.virtualRootCount,
    });
    this.event('sync', outcome, `Polling ${outcome} in ${Math.round(durationMs)} ms`);
  }

  private event(category: ActivityDebugEvent['category'], outcome: DebugOutcome, message: string): void {
    const event: ActivityDebugEvent = {
      id: ++this.sequence,
      occurredAt: new Date().toISOString(),
      category,
      outcome,
      message,
    };
    this.update({ events: [...this.snapshot.events, event].slice(-EVENT_LIMIT) });
  }

  private update(patch: Partial<ActivityDebugSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    this.subscribers.forEach((subscriber) => subscriber());
  }
}

export const activityDebugStore = new ActivityDebugStore();
