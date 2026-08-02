import { RealtimeDataChangedEvent } from './RealtimeEventBus.js';

export interface RealtimeOutboxPort {
  enqueue(event: RealtimeDataChangedEvent): Promise<void>;
  listPending(limit: number): Promise<RealtimeDataChangedEvent[]>;
  markPublished(eventId: string): Promise<void>;
  markFailed(eventId: string, error: string): Promise<void>;
}
