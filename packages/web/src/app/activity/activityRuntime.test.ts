import { describe, expect, it } from 'vitest';
import { ActiveLockRegistry, ActivityHeartbeatGate } from './activityRuntime';

describe('ActivityHeartbeatGate', () => {
  it('allows continuous activity only after the shared throttle interval', () => {
    const gate = new ActivityHeartbeatGate();
    const first = gate.start(1_000, 300);

    expect(first).not.toBeNull();
    expect(gate.start(1_100, 300)).toBeNull();
    gate.finish(first!);
    expect(gate.start(1_299, 300)).toBeNull();
    expect(gate.start(1_300, 300)).not.toBeNull();
  });

  it('blocks concurrent heartbeats even after the throttle elapsed', () => {
    const gate = new ActivityHeartbeatGate();
    const first = gate.start(1_000, 300)!;

    expect(gate.start(2_000, 300)).toBeNull();
    gate.finish(first);
    expect(gate.start(2_000, 300)).not.toBeNull();
  });

  it('invalidates an in-flight request and permits an immediate retry after reset', () => {
    const gate = new ActivityHeartbeatGate();
    const staleGeneration = gate.captureGeneration();
    const stale = gate.start(1_000, 300)!;
    gate.reset();
    const current = gate.start(1_001, 300)!;

    expect(gate.isGenerationCurrent(staleGeneration)).toBe(false);
    expect(gate.isCurrent(stale)).toBe(false);
    expect(gate.isCurrent(current)).toBe(true);
    gate.finish(stale);
    expect(gate.start(2_000, 300)).toBeNull();
    gate.finish(current);
    expect(gate.start(2_000, 300)).not.toBeNull();
  });
});

describe('ActiveLockRegistry', () => {
  it('returns each active lock once and clears the session registry', () => {
    const registry = new ActiveLockRegistry();
    registry.register({ resourceType: 'node', resourceId: 'one' });
    registry.register({ resourceType: 'node', resourceId: 'one' });
    registry.register({ resourceType: 'entity', resourceId: 'two' });

    expect(registry.values()).toHaveLength(2);
    registry.clear();
    expect(registry.values()).toEqual([]);
  });

  it('does not let stale cleanup unregister a newer owner of the same key', () => {
    const registry = new ActiveLockRegistry();
    const unregisterOld = registry.register({ resourceType: 'node', resourceId: 'one' });
    const unregisterCurrent = registry.register({ resourceType: 'node', resourceId: 'one' });

    expect(unregisterOld()).toBe(false);
    expect(registry.values()).toHaveLength(1);
    expect(unregisterCurrent()).toBe(true);
    expect(registry.values()).toEqual([]);
  });
});
