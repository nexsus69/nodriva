/** Decides whether browser cache projections can be trusted after realtime transport changes. */
import type { RealtimeConnectionState } from './RealtimeCacheBridge';

export type RealtimeReadModelState = 'initializing' | 'live' | 'unreliable' | 'disabled';

export interface RealtimeReadModelCoordinatorOptions {
  invalidateReadModel: () => void;
  setReadModelTrusted: (trusted: boolean) => void;
}

/**
 * Owns realtime continuity policy, but not event transport or cache storage.
 * Its collaborators perform the concrete invalidation and cache trust update.
 */
export class RealtimeReadModelCoordinator {
  private connectionState: RealtimeConnectionState = 'initialized';
  private capabilityEnabled = true;
  private readModelState: RealtimeReadModelState = 'initializing';
  private channelKey: string | null = null;
  private readonly subscribers = new Set<() => void>();

  public constructor(private readonly options: RealtimeReadModelCoordinatorOptions) {}

  public getConnectionState(): RealtimeConnectionState {
    return this.connectionState;
  }

  public isCapabilityEnabled(): boolean {
    return this.capabilityEnabled;
  }

  public getReadModelState(): RealtimeReadModelState {
    return this.readModelState;
  }

  public subscribe(subscriber: () => void): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  public observeConnection(state: RealtimeConnectionState): void {
    this.connectionState = state;
    if (state !== 'connected' && this.capabilityEnabled && this.readModelState === 'live') {
      this.becomeUnreliable('unreliable');
      return;
    }
    this.notify();
  }

  public setCapabilityEnabled(enabled: boolean): void {
    if (this.capabilityEnabled === enabled) return;
    this.capabilityEnabled = enabled;
    if (!enabled) {
      this.connectionState = 'unavailable';
      if (this.readModelState === 'initializing') {
        // Initial authoritative loads have no old trusted generation to purge.
        this.readModelState = 'disabled';
        this.options.setReadModelTrusted(false);
        this.notify();
        return;
      }
      this.becomeUnreliable('disabled');
      return;
    }
    this.readModelState = 'initializing';
    this.notify();
  }

  /** A changed authorized channel set revokes trust in the previous projection. */
  public observeAuthorizedChannels(dataChannels: readonly string[]): void {
    const nextKey = JSON.stringify([...dataChannels].sort());
    if (this.channelKey !== null && this.channelKey !== nextKey) this.becomeUnreliable('unreliable');
    this.channelKey = nextKey;
  }

  /** Receives the bridge's factual continuity result for the current channel heads. */
  public observeContinuity(continuous: boolean): void {
    if (!this.capabilityEnabled) return;
    if (!continuous) {
      this.becomeUnreliable('unreliable');
      return;
    }
    this.readModelState = 'live';
    this.options.setReadModelTrusted(true);
    this.notify();
  }

  public markContinuityUnknown(): void {
    if (this.capabilityEnabled) this.becomeUnreliable('unreliable');
  }

  public clearSession(): void {
    this.channelKey = null;
  }

  private becomeUnreliable(nextState: Extract<RealtimeReadModelState, 'unreliable' | 'disabled'>): void {
    if (this.readModelState === nextState) return;
    this.options.invalidateReadModel();
    this.readModelState = nextState;
    this.notify();
  }

  private notify(): void {
    this.subscribers.forEach((subscriber) => subscriber());
  }
}
