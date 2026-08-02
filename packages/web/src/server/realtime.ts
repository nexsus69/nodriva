import { randomUUID } from 'crypto';
import type {
  RealtimeChangeType,
  RealtimeDataChangedEvent,
  RealtimeResourceType,
} from '@dashboard/core';

type RealtimeChangeInput = Omit<
  RealtimeDataChangedEvent,
  'eventId' | 'occurredAt'
>;

export async function publishRealtimeChange(input: RealtimeChangeInput): Promise<void> {
  try {
    const { realtimeScopeResolver, pusherEventBus } = await import('./db');
    const event: RealtimeDataChangedEvent = {
      ...input,
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
    };

    try {
      event.scopeNodeIds = await realtimeScopeResolver.resolveScopes(event);
    } catch (error) {
      console.error('[Realtime] Failed to resolve event scopes; publishing with direct fallback:', error);
      const fallback = event.resourceType === 'node' ? event.resourceId : event.parentNodeId;
      event.scopeNodeIds = fallback ? [fallback] : [];
    }

    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await pusherEventBus.publishDataChanged(event);
        return;
      } catch (error) {
        if (attempt === maxAttempts) throw error;
        await new Promise((resolve) => setTimeout(resolve, attempt * 250));
      }
    }
  } catch (error: unknown) {
    console.error('[Realtime] Failed to publish data change after retries:', error);
  }
}

export type { RealtimeChangeType, RealtimeResourceType };
