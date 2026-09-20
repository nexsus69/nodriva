/** Verifies the common mechanics of bounded, paged resource windows. */
import { describe, expect, it, vi } from 'vitest';
import { PagedWindowCoordinator } from './PagedWindowCoordinator';

describe('PagedWindowCoordinator', () => {
  const window = (_input: string, page: { key: string }, key: string) => ({
    key,
    descriptor: {},
    references: [{ namespace: 'record', id: page.key }],
    page: 1,
    pageCount: 1,
    total: 1,
  });

  it('deduplicates reads and evicts the least recently used window', async () => {
    const release = vi.fn();
    const load = vi.fn(async (key: string) => ({ key }));
    const coordinator = new PagedWindowCoordinator(load, window, release, 2);

    await Promise.all([coordinator.read('one', 'one'), coordinator.read('one', 'one')]);
    await coordinator.read('two', 'two');
    coordinator.get('one');
    await coordinator.read('three', 'three');

    expect(load).toHaveBeenCalledTimes(3);
    expect(coordinator.values().map((entry) => entry.key)).toEqual(['one', 'three']);
    expect(release).toHaveBeenCalledWith(expect.objectContaining({ key: 'two' }));
  });

  it('reloads instead of storing a response made stale by invalidation', async () => {
    let resolveFirst: ((value: { key: string }) => void) | undefined;
    const load = vi.fn(() => {
      if (load.mock.calls.length === 1) return new Promise<{ key: string }>((resolve) => { resolveFirst = resolve; });
      return Promise.resolve({ key: 'fresh' });
    });
    const coordinator = new PagedWindowCoordinator(load, window, vi.fn());

    const result = coordinator.read('one', 'one');
    coordinator.invalidate();
    resolveFirst?.({ key: 'stale' });

    await expect(result).resolves.toEqual({ key: 'fresh' });
    expect(load).toHaveBeenCalledTimes(2);
    expect(coordinator.get('one')).toEqual(expect.objectContaining({
      key: 'one',
      references: [expect.objectContaining({ id: 'fresh' })],
    }));
  });
});
