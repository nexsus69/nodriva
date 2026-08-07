'use client';

import { useEffect } from 'react';
import { useHumanActivity } from '../../activity/ActivityProvider';

export function SessionModalWatcher() {
  const { sessionExpiresAt, isSessionExpired, checkSession, timing } = useHumanActivity();

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

  if (!isSessionExpired) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-2xl shadow-slate-900/20">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-500 ring-1 ring-rose-100">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <h3 className="mb-2 text-lg font-semibold text-slate-900">Sessione scaduta</h3>
          <p className="text-sm text-slate-500">
            Per motivi di sicurezza, la tua sessione è stata interrotta per inattività.
          </p>
        </div>
        <button
          onClick={() => {
            window.location.href = '/login?error=SessionExpired';
          }}
          className="flex w-full justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-500/20 transition-colors hover:bg-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/20"
        >
          Accedi di nuovo
        </button>
      </div>
    </div>
  );
}
