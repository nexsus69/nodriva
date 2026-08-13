import type { ResourceReference } from '@dashboard/core';
import { runtimeTiming } from '../../config/runtimeTiming';

export type SessionCheckResult = 'valid' | 'expired' | 'unreachable';
export type ActivityRequestResult =
  | { outcome: 'success'; response: Response }
  | { outcome: 'expired'; response: Response }
  | { outcome: 'unreachable'; response?: Response };

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

/** Keeps transport failures distinct from authoritative session expiry. */
export async function requestActivity(
  input: RequestInfo | URL,
  init?: RequestInit,
  fetcher: typeof fetch = fetch,
): Promise<ActivityRequestResult> {
  try {
    const response = await fetcher(input, init);
    if (response.status === 401 || isLoginRedirect(response)) {
      return { outcome: 'expired', response };
    }
    if (!response.ok) return { outcome: 'unreachable', response };
    return { outcome: 'success', response };
  } catch {
    return { outcome: 'unreachable' };
  }
}
