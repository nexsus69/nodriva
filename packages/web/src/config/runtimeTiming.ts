const DEFAULT_SESSION_IDLE_TIMEOUT_SECONDS = 5 * 60;
const SESSION_UPDATE_AGE_DIVISOR = 6;
const CACHE_SWEEP_UPDATE_AGE_DIVISOR = 2;

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const sessionIdleTimeoutSeconds = positiveInteger(
  process.env.NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_SECONDS,
  DEFAULT_SESSION_IDLE_TIMEOUT_SECONDS,
);
const sessionUpdateAgeSeconds = Math.max(
  1,
  Math.floor(sessionIdleTimeoutSeconds / SESSION_UPDATE_AGE_DIVISOR),
);
const lockTtlSeconds = sessionUpdateAgeSeconds * 2;
const sessionExpirySafetyBufferMs = Math.max(
  1,
  Math.floor((sessionUpdateAgeSeconds * 1000) / 50),
);

/**
 * Operational timings derived from one public, non-secret session policy.
 * Browser and server modules import the same values, preventing configuration
 * drift between JWT, database sessions, locks and client reconciliation.
 */
export const runtimeTiming = Object.freeze({
  sessionIdleTimeoutSeconds,
  sessionIdleTimeoutMs: sessionIdleTimeoutSeconds * 1000,
  sessionUpdateAgeSeconds,
  lockTtlSeconds,
  activityHeartbeatThrottleMs: sessionUpdateAgeSeconds * 1000,
  syncPollingIntervalMs: sessionUpdateAgeSeconds * 1000,
  metadataReconciliationIntervalMs: sessionUpdateAgeSeconds * 1000,
  sessionExpirySafetyBufferMs,
  debugPanelRefreshIntervalMs: sessionExpirySafetyBufferMs,
  cacheSweepIntervalMs: Math.max(
    1000,
    Math.floor(
      (sessionUpdateAgeSeconds * 1000) / CACHE_SWEEP_UPDATE_AGE_DIVISOR,
    ),
  ),
});
