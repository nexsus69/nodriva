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
    const { pusherEventBus } = await import('./db');
    const event: RealtimeDataChangedEvent = {
      ...input,
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
    };

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
