import { describe, expect, it } from 'vitest';
import { isOwnedLock } from './useLock';

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
});
