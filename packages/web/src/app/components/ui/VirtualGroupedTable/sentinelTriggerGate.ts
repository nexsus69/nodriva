export type SentinelDirection = 'forward' | 'backward';

export interface SentinelAvailability {
  hasMore: boolean;
  canLoadMore: boolean;
  isLoading: boolean;
}

/** Keeps debounce policy independent from IntersectionObserver and React state. */
export class SentinelTriggerGate {
  private readonly lastTriggeredAt: Partial<Record<SentinelDirection, number>> = {};

  constructor(private readonly debounceMs: number) {}

  tryTrigger(direction: SentinelDirection, now: number, availability: SentinelAvailability): boolean {
    const lastTriggeredAt = this.lastTriggeredAt[direction];
    if (lastTriggeredAt !== undefined && now - lastTriggeredAt < this.debounceMs) return false;
    if (!availability.hasMore || !availability.canLoadMore || availability.isLoading) return false;
    this.lastTriggeredAt[direction] = now;
    return true;
  }
}
