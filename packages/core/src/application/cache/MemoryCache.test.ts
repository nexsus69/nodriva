import { describe, expect, it, vi } from 'vitest';
import { MemoryCache } from './MemoryCache.js';

describe('MemoryCache', () => {
  it('caches values until invalidation', async () => {
    const cache = new MemoryCache<string, string>();
    const loader = vi.fn().mockResolvedValue('value');

    await expect(cache.getOrLoad('key', loader)).resolves.toBe('value');
    await expect(cache.getOrLoad('key', loader)).resolves.toBe('value');

    expect(loader).toHaveBeenCalledTimes(1);
    cache.invalidate('key');
    await cache.getOrLoad('key', loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('deduplicates concurrent loads', async () => {
    const cache = new MemoryCache<string, string>();
    let resolveLoader!: (value: string) => void;
    const loader = vi.fn(() => new Promise<string>((resolve) => { resolveLoader = resolve; }));

    const first = cache.getOrLoad('key', loader);
    const second = cache.getOrLoad('key', loader);
    resolveLoader('value');

    await expect(Promise.all([first, second])).resolves.toEqual(['value', 'value']);
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
