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
}

export class PusherEventBus implements LockEventBus, RealtimeEventBus {
  private readonly pusher: Pusher | null = null;

  constructor(config: PusherConfig) {
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

  private getChannelName(resourceType: string, resourceId: string): string {
    return `private-locks-${resourceType}-${resourceId}`;
  }

  private getRealtimeChannelName(resourceType: 'node' | 'entity', resourceId: string): string {
    return `private-realtime-${resourceType}-${resourceId}`;
  }

  async publishDataChanged(event: RealtimeDataChangedEvent): Promise<void> {
    if (!this.pusher) return;

    const channelNames = new Set<string>();
    channelNames.add(this.getRealtimeChannelName(event.resourceType, event.resourceId));
    if (event.parentNodeId) {
      channelNames.add(this.getRealtimeChannelName('node', event.parentNodeId));
    }
    if (event.previousParentNodeId) {
      channelNames.add(this.getRealtimeChannelName('node', event.previousParentNodeId));
    }

    await Promise.all(
      Array.from(channelNames, (channelName) =>
        this.pusher!.trigger(channelName, 'data:changed', event)
      )
    );
  }

  async publishLockAcquired(lock: Lock): Promise<void> {
    if (!this.pusher) return;
    
    console.log(`[PusherEventBus] Triggering lock:acquired for ${lock.resourceType}-${lock.resourceId} to userId ${lock.userId}`);
    await this.pusher.trigger(
      this.getChannelName(lock.resourceType, lock.resourceId),
      'lock:acquired',
      {
        resourceType: lock.resourceType,
        resourceId: lock.resourceId,
        userId: lock.userId,
        expiresAt: lock.expiresAt.toISOString()
      }
    );
  }

  async publishLockReleased(resourceType: string, resourceId: string, userId: string): Promise<void> {
    if (!this.pusher) return;

    await this.pusher.trigger(
      this.getChannelName(resourceType, resourceId),
      'lock:released',
      {
        resourceType,
        resourceId,
        userId
      }
    );
  }

  async publishLockForceReleased(resourceType: string, resourceId: string): Promise<void> {
    if (!this.pusher) return;

    await this.pusher.trigger(
      this.getChannelName(resourceType, resourceId),
      'lock:force-released',
      {
        resourceType,
        resourceId,
        byAdmin: true
      }
    );
  }
}
