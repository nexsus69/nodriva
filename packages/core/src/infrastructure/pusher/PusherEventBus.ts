import { LockEventBus } from '../../application/ports/LockEventBus.js';
import {
  RealtimeDataChangedEvent,
  RealtimeEventBus,
} from '../../application/ports/RealtimeEventBus.js';
import { Lock } from '../../domain/models/Lock.js';
import type { LockEventScope } from '../../application/ports/LockEventBus.js';
import type { ResourceReference } from '../../domain/models/ResourceReference.js';
import { PusherTransport, type PusherTransportPort, type PusherTransportConfig } from './PusherTransport.js';

export interface PusherConfig extends PusherTransportConfig {
  resolveDataChannelNames?: (event: RealtimeDataChangedEvent) => Promise<string[]>;
  resolveLockChannelNames?: (resourceType: string, resourceId: string, scopeNodeId?: string) => Promise<string[]>;
  onPublishMetric?: (metric: { eventName: string; durationMs: number; channelCount: number; success: boolean }) => void;
}

export class PusherEventBus implements LockEventBus, RealtimeEventBus {
  private readonly transport: PusherTransportPort;
  private readonly resolveDataChannelNames?: PusherConfig['resolveDataChannelNames'];
  private readonly resolveLockChannelNames?: PusherConfig['resolveLockChannelNames'];
  private readonly onPublishMetric?: PusherConfig['onPublishMetric'];

  constructor(
    config: PusherConfig,
    transport: PusherTransportPort = new PusherTransport(config),
  ) {
    this.transport = transport;
    this.resolveDataChannelNames = config.resolveDataChannelNames;
    this.resolveLockChannelNames = config.resolveLockChannelNames;
    this.onPublishMetric = config.onPublishMetric;
  }

  async publishDataChanged(event: RealtimeDataChangedEvent): Promise<void> {
    if (!this.transport.enabled || !this.resolveDataChannelNames) return;
    await this.publish('data:changed', event, () => this.resolveDataChannelNames!(event));
  }

  /** Disconnects authenticated clients so their next subscription is checked
   * against the current ACL. It intentionally remains a no-op when realtime
   * is disabled or the provider does not expose user termination. */
  async revokeUserConnections(userId: string): Promise<void> {
    if (!this.transport.enabled || !this.transport.terminateUserConnections) return;
    await this.transport.terminateUserConnections(userId);
  }

  async publishLockAcquired(lock: Lock, scope?: LockEventScope): Promise<void> {
    if (!this.transport.enabled || !this.resolveLockChannelNames) return;
    await this.publish('lock:acquired', {
        resourceType: lock.resourceType,
        resourceId: lock.resourceId,
        userId: lock.userId,
        sessionId: lock.sessionId,
        expiresAt: lock.expiresAt.toISOString()
      }, () => this.resolveLockChannelNames!(lock.resourceType, lock.resourceId, scope?.scopeNodeId));
  }

  async publishLockReleased(resource: ResourceReference, userId: string, sessionId: string, scope?: LockEventScope): Promise<void> {
    if (!this.transport.enabled || !this.resolveLockChannelNames) return;
    await this.publish('lock:released', {
        resourceType: resource.resourceType,
        resourceId: resource.resourceId,
        userId,
        sessionId
      }, () => this.resolveLockChannelNames!(resource.resourceType, resource.resourceId, scope?.scopeNodeId));
  }

  async publishLockForceReleased(resource: ResourceReference, scope?: LockEventScope): Promise<void> {
    if (!this.transport.enabled || !this.resolveLockChannelNames) return;
    await this.publish('lock:force-released', {
        resourceType: resource.resourceType,
        resourceId: resource.resourceId,
        byAdmin: true
      }, () => this.resolveLockChannelNames!(resource.resourceType, resource.resourceId, scope?.scopeNodeId));
  }

  private async publish(eventName: string, payload: unknown, resolveChannels: () => Promise<string[]>): Promise<void> {
    const startedAt = Date.now();
    let channelCount = 0;
    try {
      const channels = [...new Set(await resolveChannels())];
      channelCount = channels.length;
      await Promise.all(channels.map((channelName) => this.transport.trigger(channelName, eventName, payload)));
      this.onPublishMetric?.({ eventName, durationMs: Date.now() - startedAt, channelCount, success: true });
    } catch (error) {
      this.onPublishMetric?.({ eventName, durationMs: Date.now() - startedAt, channelCount, success: false });
      throw error;
    }
  }
}
