export interface LoginRateLimitPort {
  /** Returns the active block only; elapsed windows are not observable as blocked. */
  getBlockedUntil(subject: string, now: Date): Promise<Date | null>;
  /** Records one rejected credential attempt and returns a newly active block, if any. */
  recordFailure(subject: string, now: Date): Promise<Date | null>;
  clear(subject: string): Promise<void>;
}
