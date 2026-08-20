import { runtimeTiming } from '../../config/runtimeTiming';
import { toClientTiming, type ActivityResponse } from './activityProtocol';

export interface ActivityState {
  sessionExpiresAt?: string;
  isSessionExpired: boolean;
  timing: typeof runtimeTiming;
}

export type ActivityStateEvent =
  | { type: 'authenticated' }
  | { type: 'renewed'; expiresAt: string }
  | { type: 'expired' }
  | { type: 'logged-out' }
  | { type: 'timing-received'; timing?: ActivityResponse['timing'] };

export function initialActivityState(initialExpires?: string): ActivityState {
  return {
    sessionExpiresAt: initialExpires,
    isSessionExpired: false,
    timing: runtimeTiming,
  };
}

function sameTiming(left: typeof runtimeTiming, right: typeof runtimeTiming): boolean {
  return left.sessionIdleTimeoutSeconds === right.sessionIdleTimeoutSeconds
    && left.sessionUpdateAgeSeconds === right.sessionUpdateAgeSeconds
    && left.lockTtlSeconds === right.lockTtlSeconds
    && left.syncPollingIntervalMs === right.syncPollingIntervalMs;
}

export function reduceActivityState(state: ActivityState, event: ActivityStateEvent): ActivityState {
  switch (event.type) {
    case 'authenticated':
      return state.isSessionExpired ? { ...state, isSessionExpired: false } : state;
    case 'renewed':
      return {
        ...state,
        sessionExpiresAt: event.expiresAt,
        isSessionExpired: false,
      };
    case 'expired':
      return state.isSessionExpired ? state : { ...state, isSessionExpired: true };
    case 'logged-out':
      return {
        sessionExpiresAt: undefined,
        isSessionExpired: true,
        timing: runtimeTiming,
      };
    case 'timing-received': {
      if (!event.timing) return state;
      const timing = toClientTiming(event.timing);
      return sameTiming(state.timing, timing) ? state : { ...state, timing };
    }
  }
}
