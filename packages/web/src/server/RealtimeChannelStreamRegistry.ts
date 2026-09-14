import crypto from 'node:crypto';
import type { RealtimeChannelStreamPosition, RealtimeDataChangedEvent } from '@dashboard/core';

export interface RealtimeChannelCheckpoint {
  channelId: string;
  epoch: string;
  cursor: number;
}

interface ChannelHead {
  cursor: number;
  eventId: string | null;
}

/**
 * Tracks the process-local head of each authorized realtime stream.
 *
 * This is intentionally a bounded, volatile continuity signal rather than a
 * replay journal. A process restart changes the epoch, causing browsers to
 * invalidate their read model and fetch authoritative projections again.
 */
export class RealtimeChannelStreamRegistry {
  private readonly epoch = crypto.randomUUID();
  private readonly heads = new Map<string, ChannelHead>();

  public decorate(channelId: string, event: RealtimeDataChangedEvent): RealtimeDataChangedEvent {
    const previous = this.heads.get(channelId) ?? { cursor: 0, eventId: null };
    const cursor = previous.cursor + 1;
    this.heads.set(channelId, { cursor, eventId: event.eventId });
    const stream: RealtimeChannelStreamPosition = {
      channelId,
      epoch: this.epoch,
      cursor,
      previousCursor: previous.cursor,
      previousEventId: previous.eventId,
    };
    return { ...event, stream };
  }

  public checkpoints(channelIds: readonly string[]): RealtimeChannelCheckpoint[] {
    return [...new Set(channelIds)].sort().map((channelId) => {
      const head = this.heads.get(channelId) ?? { cursor: 0 };
      return { channelId, epoch: this.epoch, cursor: head.cursor };
    });
  }
}
