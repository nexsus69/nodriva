import { describe, expect, it } from 'vitest';
import { runtimeTiming } from '../../config/runtimeTiming';
import { initialActivityState, reduceActivityState } from './activityState';

describe('activity session state', () => {
  it('renews an expired session and adopts the authoritative expiry', () => {
    const expired = reduceActivityState(initialActivityState('old'), { type: 'expired' });
    const renewed = reduceActivityState(expired, { type: 'renewed', expiresAt: 'new' });

    expect(renewed).toMatchObject({ sessionExpiresAt: 'new', isSessionExpired: false });
  });

  it('clears expiry and restores default timing on logout', () => {
    const configured = reduceActivityState(initialActivityState('old'), {
      type: 'timing-received',
      timing: {
        sessionIdleTimeoutSeconds: 120,
        sessionUpdateAgeSeconds: 20,
        lockTtlSeconds: 40,
        syncPollingIntervalSeconds: 20,
      },
    });

    expect(reduceActivityState(configured, { type: 'logged-out' })).toEqual({
      sessionExpiresAt: undefined,
      isSessionExpired: true,
      timing: runtimeTiming,
    });
  });

  it('derives all client intervals from server timing', () => {
    const state = reduceActivityState(initialActivityState(), {
      type: 'timing-received',
      timing: {
        sessionIdleTimeoutSeconds: 600,
        sessionUpdateAgeSeconds: 100,
        lockTtlSeconds: 200,
        syncPollingIntervalSeconds: 90,
      },
    });

    expect(state.timing).toMatchObject({
      sessionIdleTimeoutMs: 600_000,
      activityHeartbeatThrottleMs: 100_000,
      lockTtlSeconds: 200,
      syncPollingIntervalMs: 90_000,
    });
  });

  it('keeps state references stable for duplicate transitions', () => {
    const state = initialActivityState();
    expect(reduceActivityState(state, { type: 'authenticated' })).toBe(state);
    expect(reduceActivityState(state, { type: 'timing-received', timing: undefined })).toBe(state);
  });
});
