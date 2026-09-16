import { describe, expect, it } from 'vitest';
import { shouldPurgeCacheForSession } from './CacheInitializer';

describe('shouldPurgeCacheForSession', () => {
  it('keeps in-flight reads during an authentication bootstrap', () => {
    expect(shouldPurgeCacheForSession('loading', false)).toBe(false);
  });

  it('purges only for a confirmed logout or expiry', () => {
    expect(shouldPurgeCacheForSession('authenticated', false)).toBe(false);
    expect(shouldPurgeCacheForSession('unauthenticated', false)).toBe(true);
    expect(shouldPurgeCacheForSession('authenticated', true)).toBe(true);
  });
});
