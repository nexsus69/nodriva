export interface LoginRateLimitPort {
  assertAllowed(subject: string, now: Date): Promise<void>;
  recordFailure(subject: string, now: Date): Promise<void>;
  clear(subject: string): Promise<void>;
}
