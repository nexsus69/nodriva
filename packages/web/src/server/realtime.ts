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
    const { realtimeScopeResolver, pusherEventBus, realtimeOutbox } = await import('./db');
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

    await realtimeOutbox.enqueue(event);

    const pendingEvents = await realtimeOutbox.listPending(25);
    for (const pending of pendingEvents) {
      try {
        await pusherEventBus.publishDataChanged(pending);
        await realtimeOutbox.markPublished(pending.eventId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await realtimeOutbox.markFailed(pending.eventId, message);
        console.error('[Realtime] Outbox delivery failed', {
          eventId: pending.eventId,
          attempts: 'incremented',
          message,
        });
        if (pending.eventId === event.eventId) return;
      }
    }
    return;
  } catch (error: unknown) {
    console.error('[Realtime] Failed to publish data change after retries:', error);
  }
}

export type { RealtimeChangeType, RealtimeResourceType };
