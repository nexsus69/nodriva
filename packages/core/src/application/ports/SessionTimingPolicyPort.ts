import type { SessionTimingPolicy } from '../services/ConfigService.js';

export interface SessionTimingPolicyPort {
  getSessionTimingPolicy(): Promise<SessionTimingPolicy>;
}
