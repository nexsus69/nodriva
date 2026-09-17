/** Synchronizes the authenticated realtime channel policy for one browser session. */
import type { RealtimeChannelCheckpoint } from './RealtimeCacheBridge';

export interface RealtimeAccessSnapshot {
  dataChannels: string[];
  lockChannels: string[];
  virtualRootNodeIds: string[];
  realtimeEnabled: boolean;
  realtimeCheckpoints: RealtimeChannelCheckpoint[];
}

export type RealtimeAccessLoadResult =
  | { kind: 'authorized'; snapshot: RealtimeAccessSnapshot }
  | { kind: 'unauthorized' };

export interface RealtimeAccessSynchronizerOptions {
  load: () => Promise<RealtimeAccessLoadResult>;
  onUnauthorized: () => void;
  onContinuityUnknown: () => void;
  setRealtimeEnabled: (enabled: boolean) => void;
  observeChannels: (channels: readonly string[]) => void;
  observeCheckpoints: (checkpoints: readonly RealtimeChannelCheckpoint[]) => void;
  retainChannels: (dataChannels: string[], lockChannels: string[]) => () => void;
  setVirtualRootNodeIds: (nodeIds: string[]) => void;
  isReadModelLive: () => boolean;
}

/**
 * Owns one in-flight access sync and the lifetime of authorized subscriptions.
 * It does not inspect cache data, apply events, or decide continuity policy.
 */
export class RealtimeAccessSynchronizer {
  private pendingSync: Promise<boolean> | null = null;
  private retainedChannelKey = '';
  private releaseChannels: (() => void) | null = null;

  public constructor(private readonly options: RealtimeAccessSynchronizerOptions) {}

  public synchronize(): Promise<boolean> {
    if (this.pendingSync) return this.pendingSync;
    const request = this.options.load()
      .then((result) => {
        if (result.kind === 'unauthorized') {
          this.options.onUnauthorized();
          return false;
        }
        this.apply(result.snapshot);
        return this.options.isReadModelLive();
      })
      .catch(() => {
        this.options.onContinuityUnknown();
        return false;
      })
      .finally(() => {
        if (this.pendingSync === request) this.pendingSync = null;
      });
    this.pendingSync = request;
    return request;
  }

  public purgeSession(): void {
    this.releaseChannels?.();
    this.releaseChannels = null;
    this.retainedChannelKey = '';
  }

  private apply(snapshot: RealtimeAccessSnapshot): void {
    this.options.setRealtimeEnabled(snapshot.realtimeEnabled);
    this.options.observeChannels(snapshot.dataChannels);
    this.options.observeCheckpoints(snapshot.realtimeCheckpoints);
    const channelKey = JSON.stringify([[...snapshot.dataChannels].sort(), [...snapshot.lockChannels].sort()]);
    if (!snapshot.realtimeEnabled) {
      this.purgeSession();
    } else if (channelKey !== this.retainedChannelKey) {
      this.releaseChannels?.();
      this.releaseChannels = this.options.retainChannels(snapshot.dataChannels, snapshot.lockChannels);
      this.retainedChannelKey = channelKey;
    }
    this.options.setVirtualRootNodeIds(snapshot.virtualRootNodeIds);
  }
}
