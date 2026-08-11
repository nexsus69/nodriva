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

  it('routes user administration events only to users with user.read', () => {
    const userPolicy = createRealtimeChannelPolicy([{
      nodeId: null, permissionKey: 'user.read', assignmentEffect: 'allow', propagation: 'global',
    }]);
    const rolePolicy = createRealtimeChannelPolicy([{
      nodeId: null, permissionKey: 'role.read', assignmentEffect: 'allow', propagation: 'global',
    }]);
    const router = new RealtimeChannelRouter([userPolicy, rolePolicy]);

    expect(router.dataChannels({
      ...event,
      resourceType: 'user',
      resourceId: 'user-2',
      scopeNodeIds: [],
      directScopeNodeIds: [],
    })).toEqual([getRealtimeDataChannelName(userPolicy)]);
  });

  it('routes administrative lock events through the matching global permission', () => {
    const userPolicy = createRealtimeChannelPolicy([{
      nodeId: null, permissionKey: 'user.read', assignmentEffect: 'allow', propagation: 'global',
    }]);
    const rolePolicy = createRealtimeChannelPolicy([{
      nodeId: null, permissionKey: 'role.read', assignmentEffect: 'allow', propagation: 'global',
    }]);
    const router = new RealtimeChannelRouter([userPolicy, rolePolicy]);

    expect(router.lockChannels('role', { scopeNodeIds: [], directScopeNodeIds: [] }))
      .toEqual([getRealtimeLockChannelName(rolePolicy)]);
  });

  it('routes node-type metadata to node_type.read administrators, not entity readers', () => {
    const nodeTypePolicy = createRealtimeChannelPolicy([{
      nodeId: null, permissionKey: 'node_type.read', assignmentEffect: 'allow', propagation: 'global',
    }]);
    const entityTypePolicy = createRealtimeChannelPolicy([{
      nodeId: null, permissionKey: 'entity_type.read', assignmentEffect: 'allow', propagation: 'global',
    }]);
    const router = new RealtimeChannelRouter([nodeTypePolicy, entityTypePolicy]);

    expect(router.dataChannels({
      ...event,
      resourceType: 'node',
      resourceId: 'project',
      scopeNodeIds: [],
      directScopeNodeIds: [],
      metadataKind: 'node',
    })).toEqual([getRealtimeDataChannelName(nodeTypePolicy)]);
  });

  it.each([
    ['user', 'user.read'],
    ['role', 'role.read'],
    ['scope', 'scope.read'],
    ['audit', 'audit.access'],
    ['system', 'system.config.read'],
    ['placement_policy', 'system.config.read'],
  ] as const)('maps %s events to %s', (resourceType, permissionKey) => {
    const matching = createRealtimeChannelPolicy([{
      nodeId: null, permissionKey: permissionKey as never, assignmentEffect: 'allow', propagation: 'global',
    }]);
    const unrelated = createRealtimeChannelPolicy([{
      nodeId: null, permissionKey: 'user.read', assignmentEffect: 'allow', propagation: 'global',
    }]);
    const router = new RealtimeChannelRouter([matching, unrelated]);

    expect(router.dataChannels({
      ...event,
      resourceType,
      resourceId: 'admin-resource',
      scopeNodeIds: [],
      directScopeNodeIds: [],
    })).toEqual([getRealtimeDataChannelName(matching)]);
  });
});
