import { describe, expect, it, vi } from 'vitest';
import { CacheRevisionStore } from './CacheRevisionStore';

describe('CacheRevisionStore', () => {
  it('increments revisions and notifies only active subscribers', () => {
    const store = new CacheRevisionStore();
    const active = vi.fn();
    const removed = vi.fn();
    store.subscribe(active);
    const unsubscribe = store.subscribe(removed);
    unsubscribe();

    store.notifyChanged();

    expect(store.getRevision()).toBe(1);
    expect(active).toHaveBeenCalledOnce();
    expect(removed).not.toHaveBeenCalled();
  });
});
