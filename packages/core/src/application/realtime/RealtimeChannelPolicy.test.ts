import { describe, expect, it } from 'vitest';
import {
  createRealtimeChannelPolicy,
  getRealtimeDataChannelName,
  policyAllowsResource,
  type RealtimeChannelRule,
} from './RealtimeChannelPolicy.js';

const allowA: RealtimeChannelRule = {
  nodeId: 'node-a',
  permissionKey: 'entity.read',
  assignmentEffect: 'allow',
  propagation: 'subtree',
};

describe('RealtimeChannelPolicy', () => {
  it('canonicalizes rule order and produces a stable channel', () => {
    const first = createRealtimeChannelPolicy([allowA]);
    const second = createRealtimeChannelPolicy([{ ...allowA }, {
      nodeId: 'node-c',
      permissionKey: 'entity.read',
      assignmentEffect: 'deny',
      propagation: 'subtree',
    }]);
    const reordered = createRealtimeChannelPolicy([{
      nodeId: 'node-c',
      permissionKey: 'entity.read',
      assignmentEffect: 'deny',
      propagation: 'subtree',
    }, allowA]);

    expect(first.channelId).not.toBe(second.channelId);
    expect(second.channelId).toBe(reordered.channelId);
    expect(getRealtimeDataChannelName(first)).toMatch(/^private-realtime-policy-[a-f0-9]{32}-data$/);
  });

  it('allows A subtree but excludes C subtree', () => {
    const policy = createRealtimeChannelPolicy([
      allowA,
      {
        nodeId: 'node-c',
        permissionKey: 'entity.read',
        assignmentEffect: 'deny',
        propagation: 'subtree',
      },
    ]);

    expect(policyAllowsResource(policy, 'entity', {
      scopeNodeIds: ['node-b', 'node-a'],
      directScopeNodeIds: ['node-b'],
    })).toBe(true);
    expect(policyAllowsResource(policy, 'entity', {
      scopeNodeIds: ['node-c-child', 'node-c', 'node-a'],
      directScopeNodeIds: ['node-c-child'],
    })).toBe(false);
  });

  it('handles self assignments independently from subtree assignments', () => {
    const policy = createRealtimeChannelPolicy([{
      nodeId: 'node-a',
      permissionKey: 'node.read',
      assignmentEffect: 'allow',
      propagation: 'self',
    }]);

    expect(policyAllowsResource(policy, 'node', {
      scopeNodeIds: ['node-a', 'node-root'],
      directScopeNodeIds: ['node-a'],
    })).toBe(true);
    expect(policyAllowsResource(policy, 'node', {
      scopeNodeIds: ['node-child', 'node-a', 'node-root'],
      directScopeNodeIds: ['node-child'],
    })).toBe(false);
  });

  it('keeps global super-admin policies absolute despite local deny rows', () => {
    const policy = createRealtimeChannelPolicy([{
      nodeId: 'node-c',
      permissionKey: 'entity.read',
      assignmentEffect: 'deny',
      propagation: 'subtree',
    }], true);

    expect(policyAllowsResource(policy, 'entity', {
      scopeNodeIds: ['node-c-child', 'node-c', 'node-a'],
      directScopeNodeIds: ['node-c-child'],
    })).toBe(true);
    expect(policyAllowsResource(policy, 'entity', {
      scopeNodeIds: ['node-b', 'node-a'],
      directScopeNodeIds: ['node-b'],
    })).toBe(true);
  });

  it('routes administrative resources only through their matching global permission', () => {
    const userAdmin = createRealtimeChannelPolicy([{
      nodeId: null,
      permissionKey: 'user.read',
      assignmentEffect: 'allow',
      propagation: 'global',
    }]);

    expect(policyAllowsResource(userAdmin, 'user', { scopeNodeIds: [] })).toBe(true);
    expect(policyAllowsResource(userAdmin, 'role', { scopeNodeIds: [] })).toBe(false);
    expect(policyAllowsResource(userAdmin, 'entity', { scopeNodeIds: ['node-a'] })).toBe(false);
  });

  it('routes metadata to type readers and honours global deny rules', () => {
    const nodeTypeReader = createRealtimeChannelPolicy([{
      nodeId: null,
      permissionKey: 'node_type.read',
      assignmentEffect: 'allow',
      propagation: 'global',
    }]);
    const denied = createRealtimeChannelPolicy([
      { nodeId: null, permissionKey: 'node_type.read', assignmentEffect: 'allow', propagation: 'global' },
      { nodeId: null, permissionKey: 'node_type.read', assignmentEffect: 'deny', propagation: 'global' },
    ]);

    expect(policyAllowsResource(nodeTypeReader, 'node', { scopeNodeIds: [] }, 'node')).toBe(true);
    expect(policyAllowsResource(nodeTypeReader, 'node', { scopeNodeIds: [] }, 'entity')).toBe(false);
    expect(policyAllowsResource(denied, 'node', { scopeNodeIds: [] }, 'node')).toBe(false);
  });
});
