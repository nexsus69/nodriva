import { describe, expect, it, vi } from 'vitest';
import { bindSentinelObserver, type SentinelObserverFactory } from './sentinelObserverBinding';

describe('sentinel observer binding', () => {
  it('observes both edges in the table scroll root and disconnects on cleanup', () => {
    const container = {} as Element;
    const top = {} as Element;
    const bottom = {} as Element;
    const observe = vi.fn();
    const disconnect = vi.fn();
    const callback = vi.fn() as unknown as IntersectionObserverCallback;
    const createObserver = vi.fn(() => ({ observe, disconnect })) as unknown as SentinelObserverFactory;

    const cleanup = bindSentinelObserver(container, top, bottom, callback, createObserver);

    expect(createObserver).toHaveBeenCalledWith(callback, { root: container, threshold: 0.01 });
    expect(observe.mock.calls).toEqual([[top], [bottom]]);
    cleanup();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
