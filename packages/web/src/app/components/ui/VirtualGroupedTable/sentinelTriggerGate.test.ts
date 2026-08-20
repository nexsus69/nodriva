import { describe, expect, it } from 'vitest';
import { SentinelTriggerGate } from './sentinelTriggerGate';

const available = { hasMore: true, canLoadMore: true, isLoading: false };

describe('SentinelTriggerGate', () => {
  it('debounces each direction independently at the existing 200ms boundary', () => {
    const gate = new SentinelTriggerGate(200);

    expect(gate.tryTrigger('forward', 1_000, available)).toBe(true);
    expect(gate.tryTrigger('forward', 1_199, available)).toBe(false);
    expect(gate.tryTrigger('backward', 1_199, available)).toBe(true);
    expect(gate.tryTrigger('forward', 1_200, available)).toBe(true);
  });

  it('does not consume the debounce window while loading is unavailable', () => {
    const gate = new SentinelTriggerGate(200);

    expect(gate.tryTrigger('forward', 1_000, { ...available, isLoading: true })).toBe(false);
    expect(gate.tryTrigger('forward', 1_001, available)).toBe(true);
  });

  it('requires both a next page and a usable cursor', () => {
    const gate = new SentinelTriggerGate(200);

    expect(gate.tryTrigger('forward', 1_000, { ...available, hasMore: false })).toBe(false);
    expect(gate.tryTrigger('forward', 1_000, { ...available, canLoadMore: false })).toBe(false);
  });
});
