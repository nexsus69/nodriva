import { describe, expect, it, vi } from 'vitest';
import { RealtimeReadModelCoordinator } from './RealtimeReadModelCoordinator';

function createCoordinator() {
  const invalidateReadModel = vi.fn();
  const setReadModelTrusted = vi.fn();
  return {
    coordinator: new RealtimeReadModelCoordinator({ invalidateReadModel, setReadModelTrusted }),
    invalidateReadModel,
    setReadModelTrusted,
  };
}

describe('RealtimeReadModelCoordinator', () => {
  it('makes a continuous authenticated checkpoint trusted and live', () => {
    const { coordinator, setReadModelTrusted } = createCoordinator();

    coordinator.observeContinuity(true);

    expect(coordinator.getReadModelState()).toBe('live');
    expect(setReadModelTrusted).toHaveBeenCalledWith(true);
  });

  it('invalidates a trusted read model after a transport outage', () => {
    const { coordinator, invalidateReadModel } = createCoordinator();
    coordinator.observeContinuity(true);

    coordinator.observeConnection('unavailable');

    expect(coordinator.getReadModelState()).toBe('unreliable');
    expect(invalidateReadModel).toHaveBeenCalledOnce();
  });

  it('keeps bootstrap data intact when realtime is initially disabled, while making it untrusted', () => {
    const { coordinator, invalidateReadModel, setReadModelTrusted } = createCoordinator();

    coordinator.setCapabilityEnabled(false);

    expect(coordinator.getReadModelState()).toBe('disabled');
    expect(invalidateReadModel).not.toHaveBeenCalled();
    expect(setReadModelTrusted).toHaveBeenCalledWith(false);
  });

  it('invalidates when the authenticated channel policy changes', () => {
    const { coordinator, invalidateReadModel } = createCoordinator();
    coordinator.observeContinuity(true);
    coordinator.observeAuthorizedChannels(['channel-a']);

    coordinator.observeAuthorizedChannels(['channel-b']);

    expect(coordinator.getReadModelState()).toBe('unreliable');
    expect(invalidateReadModel).toHaveBeenCalledOnce();
  });
});
