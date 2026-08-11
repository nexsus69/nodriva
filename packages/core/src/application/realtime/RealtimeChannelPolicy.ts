import { createHash } from 'node:crypto';
import type { RealtimeDataChangedEvent, RealtimeResourceType } from '../ports/RealtimeEventBus.js';
import type { ResourceKind } from '../../domain/models/ResourceReference.js';

export type RealtimePermissionKey =
  | 'node.read'
  | 'entity.read'
  | 'node_type.read'
  | 'entity_type.read'
  | 'user.read'
  | 'role.read'
  | 'scope.read'
  | 'audit.access'
  | 'system.config.read';
export type RealtimeAssignmentEffect = 'allow' | 'deny';
export type RealtimePropagation = 'self' | 'subtree' | 'global';

export interface RealtimeChannelRule {
  nodeId: string | null;
  permissionKey: RealtimePermissionKey;
  assignmentEffect: RealtimeAssignmentEffect;
  propagation: RealtimePropagation;
}

export interface RealtimeChannelPolicy {
  channelId: string;
  rules: RealtimeChannelRule[];
  isGlobal: boolean;
}

export interface RealtimeResourceScope {
  scopeNodeIds: string[];
  directScopeNodeIds?: string[];
}

export function canonicalizeRealtimeRules(rules: RealtimeChannelRule[]): RealtimeChannelRule[] {
  const unique = new Map<string, RealtimeChannelRule>();
  for (const rule of rules) {
    const normalized: RealtimeChannelRule = {
      nodeId: rule.nodeId,
      permissionKey: rule.permissionKey,
      assignmentEffect: rule.assignmentEffect,
      propagation: rule.propagation,
    };
    const key = [normalized.permissionKey, normalized.assignmentEffect, normalized.propagation, normalized.nodeId].join('|');
    unique.set(key, normalized);
  }
  return [...unique.values()].sort((a, b) => {
    const left = [a.permissionKey, a.assignmentEffect, a.propagation, a.nodeId].join('|');
    const right = [b.permissionKey, b.assignmentEffect, b.propagation, b.nodeId].join('|');
    return left.localeCompare(right);
  });
}

export function createRealtimeChannelPolicy(rules: RealtimeChannelRule[], isGlobal = false): RealtimeChannelPolicy {
  const canonicalRules = canonicalizeRealtimeRules(rules);
  const fingerprint = JSON.stringify({ isGlobal, rules: canonicalRules });
  const channelId = createHash('sha256').update(fingerprint).digest('hex').slice(0, 32);
  return { channelId, rules: canonicalRules, isGlobal };
}

export function getRealtimeDataChannelName(policy: RealtimeChannelPolicy): string {
  return `private-realtime-policy-${policy.channelId}-data`;
}

export function getRealtimeLockChannelName(policy: RealtimeChannelPolicy): string {
  return `private-realtime-policy-${policy.channelId}-locks`;
}

export function policyAllowsResource(
  policy: RealtimeChannelPolicy,
  resourceType: RealtimeResourceType | ResourceKind,
  scope: RealtimeResourceScope,
  metadataKind?: 'node' | 'entity',
): boolean {
  if (policy.isGlobal) return true;
  const permissionKey = permissionForResource(resourceType, metadataKind);
  const directScopeNodeIds = new Set(scope.directScopeNodeIds ?? scope.scopeNodeIds.slice(0, 1));
  const allScopeNodeIds = new Set(scope.scopeNodeIds);
  const applies = (rule: RealtimeChannelRule): boolean =>
    rule.permissionKey === permissionKey &&
    (rule.propagation === 'global'
      ? rule.nodeId === null
      : rule.propagation === 'subtree'
      ? rule.nodeId !== null && allScopeNodeIds.has(rule.nodeId)
      : rule.nodeId !== null && directScopeNodeIds.has(rule.nodeId));

  const allowed = policy.rules.some((rule) => rule.assignmentEffect === 'allow' && applies(rule));
  const denied = policy.rules.some((rule) => rule.assignmentEffect === 'deny' && applies(rule));
  return allowed && !denied;
}

export function permissionForResource(
  resourceType: RealtimeResourceType | ResourceKind,
  metadataKind?: 'node' | 'entity',
): RealtimePermissionKey {
  if (metadataKind === 'node') return 'node_type.read';
  if (metadataKind === 'entity') return 'entity_type.read';
  switch (resourceType) {
    case 'node': return 'node.read';
    case 'entity': return 'entity.read';
    case 'node_type': return 'node_type.read';
    case 'entity_type': return 'entity_type.read';
    case 'user': return 'user.read';
    case 'role': return 'role.read';
    case 'scope_assignment': return 'scope.read';
    case 'scope': return 'scope.read';
    case 'audit': return 'audit.access';
    case 'system':
    case 'system_setting':
    case 'runtime_capability':
    case 'placement_policy': return 'system.config.read';
  }
}

export function getEventScope(event: RealtimeDataChangedEvent): RealtimeResourceScope {
  const scope: RealtimeResourceScope = { scopeNodeIds: event.scopeNodeIds ?? [] };
  if (event.directScopeNodeIds) scope.directScopeNodeIds = event.directScopeNodeIds;
  return scope;
}
