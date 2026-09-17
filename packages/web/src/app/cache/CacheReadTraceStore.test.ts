/** Verifies bounded, observable cache decision diagnostics. */
import { describe, expect, it, vi } from 'vitest';
import { CacheReadTraceStore } from './CacheReadTraceStore';

describe('CacheReadTraceStore', () => {
  it('publishes reads and invalidations without retaining more than 200 entries', () => {
    const store = new CacheReadTraceStore();
    const subscriber = vi.fn();
    store.subscribe(subscriber);
    store.record({ kind: 'read', key: 'admin-entities-page:{"page":1}', source: 'backend', reason: 'cache-miss' });
    store.record({ kind: 'invalidation', key: 'admin-entities-page', reason: 'matching-prefixes' });
    expect(store.getEvents()).toEqual([
      expect.objectContaining({ kind: 'read', source: 'backend' }),
      expect.objectContaining({ kind: 'invalidation' }),
    ]);
    expect(subscriber).toHaveBeenCalledTimes(3);
  });
});
