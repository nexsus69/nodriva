'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useHumanActivity } from '../../activity/ActivityProvider';

export const SESSION_EXPIRED_LOGIN_PATH = '/login?error=SessionExpired';

/** A redirect is allowed only after the activity protocol has authoritatively marked expiry. */
export function shouldRedirectForExpiredSession(
  userId: string | undefined,
  sessionExpiresAt: string | undefined,
  isSessionExpired: boolean,
): boolean {
  return Boolean(userId && sessionExpiresAt && isSessionExpired);
}

export function SessionModalWatcher() {
  const { sessionExpiresAt, isSessionExpired, checkSession, timing } = useHumanActivity();
  const { data: session } = useSession();
  const hasStartedExpiryRedirect = useRef(false);

  useEffect(() => {
    if (!sessionExpiresAt || isSessionExpired) return;
    const parsedExpiry = Date.parse(sessionExpiresAt);
    if (!Number.isFinite(parsedExpiry)) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;
    const verify = async () => {
      const status = await checkSession();
      if (!cancelled && status === 'unreachable') {
        timeoutId = setTimeout(verify, timing.cacheSweepIntervalMs);
      }
    };
    timeoutId = setTimeout(
      verify,
      Math.max(0, parsedExpiry - Date.now() + timing.sessionExpirySafetyBufferMs),
    );

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [checkSession, isSessionExpired, sessionExpiresAt, timing]);

  // Only an authoritative activity response may cross this security boundary.
  // Network failures keep the current document and let the activity controller retry.
  useEffect(() => {
    if (!shouldRedirectForExpiredSession(session?.userId, sessionExpiresAt, isSessionExpired) || hasStartedExpiryRedirect.current) return;
    hasStartedExpiryRedirect.current = true;
    // The activity controller already purged cache and lock state. A full document
    // load also drops any stale Server Action references from a prior deployment.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Session expiry requires a fresh server-authenticated document.
    window.location.assign(SESSION_EXPIRED_LOGIN_PATH);
  }, [isSessionExpired, session?.userId, sessionExpiresAt]);

  return null;
}
