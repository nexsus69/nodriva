/** Verifies that only an authoritative expiry starts a security redirect. */
import { describe, expect, it } from 'vitest';
import {
  SESSION_EXPIRED_LOGIN_PATH,
  shouldRedirectForExpiredSession,
} from './SessionModalWatcher';

describe('session expiry redirect', () => {
  it('redirects a verified expired session to the login form', () => {
    expect(shouldRedirectForExpiredSession('user-1', '2026-09-28T10:00:00.000Z', true)).toBe(true);
    expect(SESSION_EXPIRED_LOGIN_PATH).toBe('/login?error=SessionExpired');
  });

  it('does not redirect without an authenticated expiry state', () => {
    expect(shouldRedirectForExpiredSession('user-1', '2026-09-28T10:00:00.000Z', false)).toBe(false);
    expect(shouldRedirectForExpiredSession(undefined, '2026-09-28T10:00:00.000Z', true)).toBe(false);
  });
});
