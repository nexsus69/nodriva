import type { ResourceReference } from '@dashboard/core';
import { runtimeTiming } from '../../config/runtimeTiming';

export type SessionCheckResult = 'valid' | 'expired' | 'unreachable';

export interface ActivityResponse {
  sessionExpiresAt: string;
  renewedLocks: Array<ResourceReference & { expiresAt: string }>;
  timing?: {
    sessionIdleTimeoutSeconds: number;
    sessionUpdateAgeSeconds: number;
    lockTtlSeconds: number;
    syncPollingIntervalSeconds: number;
  };
}

export function toClientTiming(value: ActivityResponse['timing']): typeof runtimeTiming {
  if (!value) return runtimeTiming;
  return {
    ...runtimeTiming,
    sessionIdleTimeoutSeconds: value.sessionIdleTimeoutSeconds,
    sessionIdleTimeoutMs: value.sessionIdleTimeoutSeconds * 1000,
    sessionUpdateAgeSeconds: value.sessionUpdateAgeSeconds,
    lockTtlSeconds: value.lockTtlSeconds,
    activityHeartbeatThrottleMs: value.sessionUpdateAgeSeconds * 1000,
    syncPollingIntervalMs: value.syncPollingIntervalSeconds * 1000,
  };
}

export function isLoginRedirect(response: Response): boolean {
  if (!response.redirected) return false;
  try { return new URL(response.url).pathname === '/login'; } catch { return false; }
}
