import { describe, expect, it, vi } from 'vitest';
import { LockStateStore } from './LockStateStore';

describe('LockStateStore', () => {
  it('keeps lock state per resource and notifies only its subscribers', () => {
    const onChanged = vi.fn();
    const store = new LockStateStore({ load: vi.fn(), onChanged });
    const nodeSubscriber = vi.fn();
    const entitySubscriber = vi.fn();
    store.subscribe('node', 'node-1', nodeSubscriber);
    store.subscribe('entity', 'entity-1', entitySubscriber);

    store.set('node', 'node-1', { locked: true, byUserId: 'user-1' });
    store.set('entity', 'entity-1', { locked: false });

    expect(nodeSubscriber).toHaveBeenCalledWith({ locked: true, byUserId: 'user-1' });
    expect(entitySubscriber).toHaveBeenCalledWith({ locked: false });
    expect(onChanged).toHaveBeenCalledTimes(2);
  });

  it('deduplicates hydration and preserves a newer local acquisition over an older unlocked snapshot', async () => {
    let resolveLoad: ((state: { locked: boolean }) => void) | undefined;
    const load = vi.fn(() => new Promise<{ locked: boolean }>((resolve) => { resolveLoad = resolve; }));
    const store = new LockStateStore({ load });

    const first = store.hydrate('node', 'node-1');
    const second = store.hydrate('node', 'node-1');
    store.set('node', 'node-1', { locked: true, bySessionId: 'newer-session' });
    resolveLoad!({ locked: false });
    await Promise.all([first, second]);

    expect(load).toHaveBeenCalledTimes(1);
    expect(store.get('node', 'node-1')).toEqual({ locked: true, bySessionId: 'newer-session' });
  });

  it('treats expired snapshots as unlocked without mutating the stored snapshot', () => {
    const store = new LockStateStore({
      load: vi.fn(),
      now: () => Date.parse('2026-01-02T00:00:00.000Z'),
    });
    store.set('node', 'node-1', { locked: true, expiresAt: '2026-01-01T00:00:00.000Z' });

    expect(store.get('node', 'node-1')).toEqual({ locked: false });
  });

  it('keeps subscriptions across a read-model reset and removes them only on session purge', () => {
    const store = new LockStateStore({ load: vi.fn() });
    const subscriber = vi.fn();
    store.subscribe('node', 'node-1', subscriber);

    store.set('node', 'node-1', { locked: true });
    store.clearReadModel();
    store.set('node', 'node-1', { locked: false });
    store.purge();
    store.set('node', 'node-1', { locked: true });

    expect(subscriber).toHaveBeenCalledTimes(2);
    expect(subscriber).toHaveBeenNthCalledWith(2, { locked: false });
  });
});
