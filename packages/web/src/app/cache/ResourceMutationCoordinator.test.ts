/** Verifies local mutation/realtime correlation and pending-resource state. */
import { describe, expect, it } from 'vitest';
import { ResourceMutationCoordinator } from './ResourceMutationCoordinator';

describe('ResourceMutationCoordinator', () => {
  it('ignores the realtime confirmation while the local mutation is pending', async () => {
    const coordinator = new ResourceMutationCoordinator();
    let release!: () => void;
    const pending = new Promise<{ rowVersion: number }>((resolve) => { release = () => resolve({ rowVersion: 2 }); });
    let committed = 0;

    const operation = coordinator.run(
      'entity:entity-1',
      async (mutationId) => {
        expect(coordinator.isLocalEvent({ mutationId })).toBe(true);
        expect(coordinator.isPending('entity:entity-1')).toBe(true);
        release();
        return pending;
      },
      (result) => { committed = result.rowVersion; },
    );

    await expect(operation).resolves.toEqual({ rowVersion: 2 });
    expect(committed).toBe(2);
  });

  it('keeps completed mutation confirmations local and accepts external events', async () => {
    const coordinator = new ResourceMutationCoordinator();
    let mutationId = '';
    await coordinator.run(
      'node:node-1',
      async (id) => { mutationId = id; return { rowVersion: 3 }; },
      () => undefined,
    );

    expect(coordinator.isLocalEvent({ mutationId })).toBe(true);
    expect(coordinator.isLocalEvent({ mutationId: 'external-mutation' })).toBe(false);
    expect(coordinator.isLocalEvent({})).toBe(false);
    expect(coordinator.isPending('node:node-1')).toBe(false);
    expect(coordinator.isLocalVersion('node:node-1', 3)).toBe(true);
    expect(coordinator.isLocalVersion('node:node-1', 2)).toBe(false);
  });

  it('ignores events from the configured authenticated session', () => {
    const coordinator = new ResourceMutationCoordinator();
    coordinator.setOriginSessionId('session-1');
    expect(coordinator.isLocalEvent({ originSessionId: 'session-1' })).toBe(true);
    expect(coordinator.isLocalEvent({ originSessionId: 'session-2' })).toBe(false);
  });
});
