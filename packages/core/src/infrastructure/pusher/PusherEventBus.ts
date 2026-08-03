import { LockEventBus } from '../../application/ports/LockEventBus.js';
import {
  RealtimeDataChangedEvent,
  RealtimeEventBus,
} from '../../application/ports/RealtimeEventBus.js';
import { Lock } from '../../domain/models/Lock.js';
import Pusher from 'pusher';

export interface PusherConfig {
  appId: string;
  key: string;
  secret: string;
  cluster: string;
  useTLS?: boolean;
  host?: string;
  port?: string;
  enabled?: boolean;
  resolveResourceScopeIds?: (resourceType: string, resourceId: string) => Promise<string[]>;
}

export class PusherEventBus implements LockEventBus, RealtimeEventBus {
  private readonly pusher: Pusher | null = null;
  private readonly resolveResourceScopeIds?: PusherConfig['resolveResourceScopeIds'];

  constructor(config: PusherConfig) {
    this.resolveResourceScopeIds = config.resolveResourceScopeIds;
    if (config.enabled !== false && config.appId && config.key && config.secret && config.cluster) {
      this.pusher = new Pusher({
        appId: config.appId,
        key: config.key,
        secret: config.secret,
        cluster: config.cluster,
        useTLS: config.useTLS ?? true,
        host: config.host,
        port: config.port,
      });
    } else {
      console.warn('[PusherEventBus] Pusher is disabled because configuration is missing.');
    }
  }

  private getScopeChannelName(nodeId: string, propagation: 'self' | 'subtree'): string {
    return `private-scope-node-${nodeId}-${propagation}`;
  }

  async publishDataChanged(event: RealtimeDataChangedEvent): Promise<void> {
    if (!this.pusher) return;

    const scopeNodeIds = event.scopeNodeIds ?? [
      ...(event.parentNodeId ? [event.parentNodeId] : []),
      ...(event.resourceType === 'node' ? [event.resourceId] : []),
      ...(event.previousParentNodeId ? [event.previousParentNodeId] : []),
    ];
    const channelNames = new Set(
      scopeNodeIds.map((nodeId) => `private-events-node-${nodeId}`)
    );

    if (channelNames.size === 0) {
      throw new Error(
        `Cannot publish realtime event ${event.eventId}: no node scope was resolved`
      );
    }

    await Promise.all(
      Array.from(channelNames, (channelName) =>
        this.pusher!.trigger(channelName, 'data:changed', event)
      )
    );
  }

  async publishLockAcquired(lock: Lock): Promise<void> {
    if (!this.pusher) return;
    const scopeIds = await this.configuredScopeIds(lock.resourceType, lock.resourceId);
    await Promise.all(this.getScopeChannels(scopeIds).map((channelName) => this.pusher!.trigger(
      channelName, 'lock:acquired', {
        resourceType: lock.resourceType,
        resourceId: lock.resourceId,
        userId: lock.userId,
        expiresAt: lock.expiresAt.toISOString()
      })));
  }

  async publishLockReleased(resourceType: string, resourceId: string, userId: string): Promise<void> {
    if (!this.pusher) return;

    const scopeIds = await this.configuredScopeIds(resourceType, resourceId);
    await Promise.all(this.getScopeChannels(scopeIds).map((channelName) => this.pusher!.trigger(
      channelName, 'lock:released', {
        resourceType,
        resourceId,
        userId
      })));
  }

  async publishLockForceReleased(resourceType: string, resourceId: string): Promise<void> {
    if (!this.pusher) return;

    const scopeIds = await this.configuredScopeIds(resourceType, resourceId);
    await Promise.all(this.getScopeChannels(scopeIds).map((channelName) => this.pusher!.trigger(
      channelName, 'lock:force-released', {
        resourceType,
        resourceId,
        byAdmin: true
      })));
  }

  private async configuredScopeIds(resourceType: string, resourceId: string): Promise<string[]> {
    if (!this.resolveResourceScopeIds) return [];
    return this.resolveResourceScopeIds(resourceType, resourceId);
  }

  private getScopeChannels(scopeIds: string[]): string[] {
    return scopeIds.flatMap((nodeId, index) => [
      this.getScopeChannelName(nodeId, 'subtree'),
      ...(index === 0 ? [this.getScopeChannelName(nodeId, 'self')] : []),
    ]);
  }
}
