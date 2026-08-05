import { RealtimeDataChangedEvent } from './RealtimeEventBus.js';

export interface RealtimeOutboxPort {
  enqueue(event: RealtimeDataChangedEvent): Promise<void>;
  claimPending(workerId: string, limit: number): Promise<RealtimeDataChangedEvent[]>;
  markPublished(eventId: string, workerId: string): Promise<void>;
  markFailed(eventId: string, workerId: string, error: string): Promise<void>;
  getOperationalStats(): Promise<RealtimeOutboxOperationalStats>;
}

export interface RealtimeOutboxOperationalStats {
  pendingCount: number;
  leasedCount: number;
  retryingCount: number;
  oldestPendingAgeSeconds: number;
  maxAttempts: number;
}
