/** Verifies process-local stream cursors used for conservative browser cache continuity checks. */
import { describe, expect, it } from 'vitest';
import { RealtimeChannelStreamRegistry } from './RealtimeChannelStreamRegistry';

const event = (eventId: string) => ({
  eventId,
  occurredAt: '2026-09-14T10:00:00.000Z',
  resourceType: 'node' as const,
  resourceId: 'node-1',
  changeType: 'updated' as const,
  actorUserId: 'user-1',
});

describe('RealtimeChannelStreamRegistry', () => {
  it('assigns independent, contiguous positions for each policy channel', () => {
    const registry = new RealtimeChannelStreamRegistry();
    const first = registry.decorate('channel-a', event('event-1'));
    const second = registry.decorate('channel-a', event('event-2'));
    const other = registry.decorate('channel-b', event('event-3'));

    expect(first.stream).toMatchObject({ channelId: 'channel-a', cursor: 1, previousCursor: 0, previousEventId: null });
    expect(second.stream).toMatchObject({ channelId: 'channel-a', cursor: 2, previousCursor: 1, previousEventId: 'event-1' });
    expect(other.stream).toMatchObject({ channelId: 'channel-b', cursor: 1, previousCursor: 0, previousEventId: null });
  });

  it('reports the current process epoch and watermark without retaining event payloads', () => {
    const registry = new RealtimeChannelStreamRegistry();
    const first = registry.decorate('channel-a', event('event-1'));
    const checkpoints = registry.checkpoints(['channel-b', 'channel-a', 'channel-a']);

    expect(checkpoints).toEqual([
      { channelId: 'channel-a', epoch: first.stream?.epoch, cursor: 1 },
      { channelId: 'channel-b', epoch: first.stream?.epoch, cursor: 0 },
    ]);
  });
});
