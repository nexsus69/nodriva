import { describe, expect, it, vi } from 'vitest';
import { AdminRealtimeInvalidationBus } from './AdminRealtimeInvalidationBus';

describe('AdminRealtimeInvalidationBus', () => {
  it('publishes one targeted invalidation to active subscribers only', () => {
    const bus = new AdminRealtimeInvalidationBus();
    const active = vi.fn();
    const removed = vi.fn();
    bus.subscribe(active);
    const unsubscribe = bus.subscribe(removed);
    unsubscribe();

    bus.publish(['users']);

    expect(active).toHaveBeenCalledWith(['users']);
    expect(removed).not.toHaveBeenCalled();
  });
});
