/** Verifies lock ownership and deployment-safe cleanup transport. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isOwnedLock, LOCK_RELEASE_ENDPOINT, releaseLockThroughApi } from './useLock';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isOwnedLock', () => {
  it('accepts the server-confirmed session while the client session is synchronizing', () => {
    expect(
      isOwnedLock(
        { locked: true, bySessionId: 'server-session' },
        undefined,
        'server-session',
      ),
    ).toBe(true);
  });

  it('does not mistake another session lock for the current user lock', () => {
    expect(
      isOwnedLock(
        { locked: true, bySessionId: 'other-session' },
        'current-session',
        'server-session',
      ),
    ).toBe(false);
  });

  it('uses the stable HTTP cleanup endpoint instead of a Server Action reference', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetcher);

    releaseLockThroughApi({ resourceType: 'node', resourceId: 'node-1' });

    expect(fetcher).toHaveBeenCalledWith(LOCK_RELEASE_ENDPOINT, expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ resourceType: 'node', resourceId: 'node-1' }),
      keepalive: false,
    }));
  });
});
