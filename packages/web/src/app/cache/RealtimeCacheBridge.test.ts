import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RealtimeCacheBridge } from './RealtimeCacheBridge';

type Handler = (payload: unknown) => void;

class MockChannel {
  handlers = new Map<string, Handler[]>();

  bind(eventName: string, handler: Handler) {
    this.handlers.set(eventName, [...(this.handlers.get(eventName) ?? []), handler]);
  }

  unbind() {}

  unbind_all() {
    this.handlers.clear();
  }

  emit(eventName: string, payload: unknown) {
    this.handlers.get(eventName)?.forEach((handler) => handler(payload));
  }
}

const { MockPusher } = vi.hoisted(() => {
  class HoistedMockPusher {
    static instance: HoistedMockPusher;
    connection = { bind: vi.fn() };
    channels = new Map<string, MockChannel>();

    constructor() {
      HoistedMockPusher.instance = this;
    }

    subscribe(channelName: string) {
      const channel = this.channels.get(channelName) ?? new MockChannel();
      this.channels.set(channelName, channel);
      return channel;
    }

    unsubscribe() {}
    disconnect() {}
  }

  return { MockPusher: HoistedMockPusher };
});

vi.mock('pusher-js', () => ({ default: MockPusher }));

describe('RealtimeCacheBridge debug events', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_REALTIME_ENABLED = 'true';
    process.env.NEXT_PUBLIC_PUSHER_KEY = 'test-key';
    MockPusher.instance = undefined as unknown as InstanceType<typeof MockPusher>;
  });

  it('reports data and lock events with their subscribed channel', () => {
    const debugEvents: { channelName: string; eventName: string }[] = [];
    const bridge = new RealtimeCacheBridge(
      vi.fn(),
      vi.fn(),
      (event) => debugEvents.push({ channelName: event.channelName, eventName: event.eventName })
    );

    bridge.retainPolicyChannels(['channel-data'], ['channel-lock']);
    MockPusher.instance.channels.get('channel-data')?.emit('data:changed', { eventId: 'evt-1' });
    MockPusher.instance.channels.get('channel-lock')?.emit('lock:acquired', {
      resourceType: 'entity',
      resourceId: 'entity-1',
    });

    expect(debugEvents).toEqual([
      { channelName: 'channel-data', eventName: 'data:changed' },
      { channelName: 'channel-lock', eventName: 'lock:acquired' },
    ]);
  });

  it('reports subscription errors without throwing to the caller', () => {
    const debugEvents: string[] = [];
    const bridge = new RealtimeCacheBridge(vi.fn(), undefined, (event) => debugEvents.push(event.eventName));

    bridge.retainPolicyChannels(['channel-data'], []);
    MockPusher.instance.channels.get('channel-data')?.emit('pusher:subscription_error', { status: 403 });

    expect(debugEvents).toEqual(['pusher:subscription_error']);
  });

  it('reports gaps in the metadata event sequence', () => {
    const gaps: { stream: string; key: string; expected: number; received: number }[] = [];
    const bridge = new RealtimeCacheBridge(vi.fn(), undefined, undefined, undefined, (gap) => gaps.push(gap));

    bridge.retainPolicyChannels(['channel-data'], []);
    const channel = MockPusher.instance.channels.get('channel-data');
    channel?.emit('data:changed', { eventId: 'evt-1', metadataKind: 'node', metadataSequence: 4 });
    channel?.emit('data:changed', { eventId: 'evt-2', metadataKind: 'node', metadataSequence: 6 });

    expect(gaps).toEqual([{ stream: 'metadata', key: 'node', expected: 5, received: 6 }]);
  });
});
