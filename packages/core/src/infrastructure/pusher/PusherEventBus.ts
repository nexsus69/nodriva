/** Publishes authorized realtime and lock notifications through a Pusher-compatible transport. */
import type { LockEventBus } from '../../application/ports/LockEventBus.js';
import type {
  RealtimeDataChangedEvent,
  RealtimeEventBus,
} from '../../application/ports/RealtimeEventBus.js';
import type { Lock } from '../../domain/models/Lock.js';
import type { LockEventScope } from '../../application/ports/LockEventBus.js';
import type { ResourceReference } from '../../domain/models/ResourceReference.js';
import { PusherTransport, type PusherTransportPort, type PusherTransportConfig } from './PusherTransport.js';

export interface RealtimeDataChannelDelivery {
  channelName: string;
  payload: RealtimeDataChangedEvent;
}

export interface PusherConfig extends PusherTransportConfig {
  resolveDataChannelNames?: (event: RealtimeDataChangedEvent) => Promise<string[]>;
  resolveDataChannelDeliveries?: (event: RealtimeDataChangedEvent) => Promise<RealtimeDataChannelDelivery[]>;
  resolveLockChannelNames?: (resourceType: string, resourceId: string, scopeNodeId?: string) => Promise<string[]>;
  onPublishMetric?: (metric: { eventName: string; durationMs: number; channelCount: number; success: boolean }) => void;
  isEnabled?: () => Promise<boolean>;
}

export class PusherEventBus implements LockEventBus, RealtimeEventBus {
  private readonly transport: PusherTransportPort;
  private readonly resolveDataChannelNames?: PusherConfig['resolveDataChannelNames'];
  private readonly resolveDataChannelDeliveries?: PusherConfig['resolveDataChannelDeliveries'];
  private readonly resolveLockChannelNames?: PusherConfig['resolveLockChannelNames'];
  private readonly onPublishMetric?: PusherConfig['onPublishMetric'];
  private readonly isEnabled?: PusherConfig['isEnabled'];

  constructor(
    config: PusherConfig,
    transport: PusherTransportPort = new PusherTransport(config),
  ) {
    this.transport = transport;
    this.resolveDataChannelNames = config.resolveDataChannelNames;
    this.resolveDataChannelDeliveries = config.resolveDataChannelDeliveries;
    this.resolveLockChannelNames = config.resolveLockChannelNames;
    this.onPublishMetric = config.onPublishMetric;
    this.isEnabled = config.isEnabled;
  }

  async publishDataChanged(event: RealtimeDataChangedEvent): Promise<void> {
    if (!(await this.enabled()) || (!this.resolveDataChannelNames && !this.resolveDataChannelDeliveries)) return;
    if (this.resolveDataChannelDeliveries) {
      await this.publishDataDeliveries(event);
      return;
    }
    await this.publish('data:changed', event, () => this.resolveDataChannelNames!(event));
  }

  private async publishDataDeliveries(event: RealtimeDataChangedEvent): Promise<void> {
    const startedAt = Date.now();
    let channelCount = 0;
    try {
      const deliveries = await this.resolveDataChannelDeliveries!(event);
      const uniqueDeliveries = new Map<string, RealtimeDataChangedEvent>();
      deliveries.forEach((delivery) => uniqueDeliveries.set(delivery.channelName, delivery.payload));
      channelCount = uniqueDeliveries.size;
      await Promise.all([...uniqueDeliveries].map(([channelName, payload]) => (
        this.transport.trigger(channelName, 'data:changed', payload)
      )));
      this.onPublishMetric?.({ eventName: 'data:changed', durationMs: Date.now() - startedAt, channelCount, success: true });
    } catch (error) {
      this.onPublishMetric?.({ eventName: 'data:changed', durationMs: Date.now() - startedAt, channelCount, success: false });
      throw error;
    }
  }

  /** Disconnects authenticated clients so their next subscription is checked
   * against the current ACL. It intentionally remains a no-op when realtime
   * is disabled or the provider does not expose user termination. */
  async revokeUserConnections(userId: string): Promise<void> {
    if (!(await this.enabled()) || !this.transport.terminateUserConnections) return;
    await this.transport.terminateUserConnections(userId);
  }

  async publishLockAcquired(lock: Lock, scope?: LockEventScope): Promise<void> {
    if (!(await this.enabled()) || !this.resolveLockChannelNames) return;
    await this.publish('lock:acquired', {
        resourceType: lock.resourceType,
        resourceId: lock.resourceId,
        userId: lock.userId,
        sessionId: lock.sessionId,
        expiresAt: lock.expiresAt.toISOString()
      }, () => this.resolveLockChannelNames!(lock.resourceType, lock.resourceId, scope?.scopeNodeId));
  }

  async publishLockReleased(resource: ResourceReference, userId: string, sessionId: string, scope?: LockEventScope): Promise<void> {
    if (!(await this.enabled()) || !this.resolveLockChannelNames) return;
    await this.publish('lock:released', {
        resourceType: resource.resourceType,
        resourceId: resource.resourceId,
        userId,
        sessionId
      }, () => this.resolveLockChannelNames!(resource.resourceType, resource.resourceId, scope?.scopeNodeId));
  }

  async publishLockForceReleased(resource: ResourceReference, scope?: LockEventScope): Promise<void> {
    if (!(await this.enabled()) || !this.resolveLockChannelNames) return;
    await this.publish('lock:force-released', {
        resourceType: resource.resourceType,
        resourceId: resource.resourceId,
        byAdmin: true
      }, () => this.resolveLockChannelNames!(resource.resourceType, resource.resourceId, scope?.scopeNodeId));
  }

  private async enabled(): Promise<boolean> {
    if (!this.transport.enabled) return false;
    return this.isEnabled ? this.isEnabled() : true;
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
