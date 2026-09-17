import { describe, expect, it, vi } from 'vitest';
import { RealtimeDebugStore } from './RealtimeDebugStore';

describe('RealtimeDebugStore', () => {
  it('immediately exposes the current snapshot and publishes appends and clears', () => {
    const store = new RealtimeDebugStore();
    const subscriber = vi.fn();
    store.subscribe(subscriber);

    store.append({ id: 'event-1', channelName: 'data', eventName: 'data:changed', receivedAt: '2026-09-17T00:00:00.000Z', payload: {} });
    store.clear();

    expect(subscriber).toHaveBeenNthCalledWith(1, []);
    expect(subscriber).toHaveBeenNthCalledWith(2, [expect.objectContaining({ id: 'event-1' })]);
    expect(subscriber).toHaveBeenNthCalledWith(3, []);
  });

  it('keeps only the latest 200 diagnostic events', () => {
    const store = new RealtimeDebugStore();
    for (let index = 0; index < 201; index += 1) {
      store.append({ id: `${index}`, channelName: 'data', eventName: 'data:changed', receivedAt: '', payload: {} });
    }

    expect(store.getEvents()).toHaveLength(200);
    expect(store.getEvents()[0]?.id).toBe('1');
  });
});
