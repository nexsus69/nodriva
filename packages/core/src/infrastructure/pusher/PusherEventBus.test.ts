import { describe, expect, it, vi } from 'vitest';
import { Lock } from '../../domain/models/Lock.js';
import { PusherEventBus } from './PusherEventBus.js';
import type { PusherTransportPort } from './PusherTransport.js';
import type { RealtimeDataChangedEvent } from '../../application/ports/RealtimeEventBus.js';

function transport(enabled = true): PusherTransportPort & { trigger: ReturnType<typeof vi.fn>; terminateUserConnections: ReturnType<typeof vi.fn> } {
  return { enabled, trigger: vi.fn().mockResolvedValue(undefined), terminateUserConnections: vi.fn().mockResolvedValue(undefined) };
}

const event: RealtimeDataChangedEvent = {
  eventId: 'event-1',
  occurredAt: '2026-08-03T10:00:00.000Z',
  resourceType: 'node',
  resourceId: 'node-a',
  changeType: 'updated',
  actorUserId: 'user-1',
};

describe('PusherEventBus', () => {
  it('is a no-op when the realtime transport is disabled', async () => {
    const mock = transport(false);
    const bus = new PusherEventBus({ appId: '', key: '', secret: '', cluster: '', enabled: false }, mock);

    await bus.publishDataChanged(event);
    await bus.publishLockForceReleased('node', 'node-a');

    expect(mock.trigger).not.toHaveBeenCalled();
  });

  it('publishes data to the resolved unique policy channels', async () => {
    const mock = transport();
    const bus = new PusherEventBus({
      appId: 'app', key: 'key', secret: 'secret', cluster: 'eu',
      resolveDataChannelNames: async () => ['channel-1', 'channel-1', 'channel-2'],
    }, mock);

    await bus.publishDataChanged(event);
    expect(mock.trigger).toHaveBeenCalledTimes(2);
    expect(mock.trigger).toHaveBeenCalledWith('channel-1', 'data:changed', event);
    expect(mock.trigger).toHaveBeenCalledWith('channel-2', 'data:changed', event);
  });

  it('propagates transport failures to the caller for outbox retry handling', async () => {
    const mock = transport();
    mock.trigger.mockRejectedValueOnce(new Error('pusher unavailable'));
    const bus = new PusherEventBus({
      appId: 'app', key: 'key', secret: 'secret', cluster: 'eu',
      resolveDataChannelNames: async () => ['channel-1'],
    }, mock);

    await expect(bus.publishDataChanged(event)).rejects.toThrow('pusher unavailable');
  });

  it('terminates authenticated connections when a policy is revoked', async () => {
    const mock = transport();
    const bus = new PusherEventBus({ appId: 'app', key: 'key', secret: 'secret', cluster: 'eu' }, mock);

    await bus.revokeUserConnections('user-revoked');

    expect(mock.terminateUserConnections).toHaveBeenCalledWith('user-revoked');
  });

  it('publishes lock events only to resolved policy channels', async () => {
    const mock = transport();
    const resolveLockChannelNames = vi.fn().mockResolvedValue(['lock-channel']);
    const onPublishMetric = vi.fn();
    const bus = new PusherEventBus({
      appId: 'app', key: 'key', secret: 'secret', cluster: 'eu',
      resolveLockChannelNames,
      onPublishMetric,
    }, mock);
    const lock = new Lock('lock-1', 'node', 'node-a', 'user-1', 'session-1', new Date('2026-08-03T10:00:00Z'), new Date('2026-08-03T10:02:00Z'));

    await bus.publishLockAcquired(lock, { scopeNodeId: 'node-parent' });
    expect(mock.trigger).toHaveBeenCalledWith('lock-channel', 'lock:acquired', expect.objectContaining({ resourceId: 'node-a' }));
    expect(resolveLockChannelNames).toHaveBeenCalledWith('node', 'node-a', 'node-parent');
    expect(onPublishMetric).toHaveBeenCalledWith(expect.objectContaining({
      eventName: 'lock:acquired', channelCount: 1, success: true,
    }));
  });
});
