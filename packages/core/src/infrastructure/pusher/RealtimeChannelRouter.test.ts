import { describe, expect, it } from 'vitest';
import { createRealtimeChannelPolicy, getRealtimeDataChannelName, getRealtimeLockChannelName } from '../../application/realtime/RealtimeChannelPolicy.js';
import type { RealtimeDataChangedEvent } from '../../application/ports/RealtimeEventBus.js';
import { RealtimeChannelRouter } from './RealtimeChannelRouter.js';

const event: RealtimeDataChangedEvent = {
  eventId: 'event-1',
  occurredAt: '2026-08-03T10:00:00.000Z',
  resourceType: 'entity',
  resourceId: 'entity-c',
  changeType: 'updated',
  actorUserId: 'user-1',
  scopeNodeIds: ['node-c', 'node-a'],
  directScopeNodeIds: ['node-c'],
  parentNodeId: 'node-c',
};

describe('RealtimeChannelRouter', () => {
  it('routes a descendant event only to policies that can see it', () => {
    const broad = createRealtimeChannelPolicy([{
      nodeId: 'node-a', permissionKey: 'entity.read', assignmentEffect: 'allow', propagation: 'subtree',
    }]);
    const excluded = createRealtimeChannelPolicy([
      { nodeId: 'node-a', permissionKey: 'entity.read', assignmentEffect: 'allow', propagation: 'subtree' },
      { nodeId: 'node-c', permissionKey: 'entity.read', assignmentEffect: 'deny', propagation: 'subtree' },
    ]);
    const router = new RealtimeChannelRouter([broad, excluded]);

    expect(router.dataChannels(event)).toEqual([getRealtimeDataChannelName(broad)]);
    expect(router.lockChannels('entity', {
      scopeNodeIds: event.scopeNodeIds!,
      ...(event.directScopeNodeIds ? { directScopeNodeIds: event.directScopeNodeIds } : {}),
    })).toEqual([getRealtimeLockChannelName(broad)]);
  });

  it('routes an event outside the denied subtree to both policies', () => {
    const broad = createRealtimeChannelPolicy([{
      nodeId: 'node-a', permissionKey: 'entity.read', assignmentEffect: 'allow', propagation: 'subtree',
    }]);
    const excluded = createRealtimeChannelPolicy([
      { nodeId: 'node-a', permissionKey: 'entity.read', assignmentEffect: 'allow', propagation: 'subtree' },
      { nodeId: 'node-c', permissionKey: 'entity.read', assignmentEffect: 'deny', propagation: 'subtree' },
    ]);
    const router = new RealtimeChannelRouter([broad, excluded]);

    expect(router.dataChannels({ ...event, scopeNodeIds: ['node-b', 'node-a'], directScopeNodeIds: ['node-b'] }))
      .toEqual([getRealtimeDataChannelName(broad), getRealtimeDataChannelName(excluded)]);
  });
});
