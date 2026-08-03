import { createHash } from 'node:crypto';
import type { RealtimeDataChangedEvent, RealtimeResourceType } from '../ports/RealtimeEventBus.js';

export type RealtimePermissionKey = 'node.read' | 'entity.read';
export type RealtimeAssignmentEffect = 'allow' | 'deny';
export type RealtimePropagation = 'self' | 'subtree';

export interface RealtimeChannelRule {
  nodeId: string;
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
  resourceType: RealtimeResourceType,
  scope: RealtimeResourceScope
): boolean {
  const permissionKey: RealtimePermissionKey = resourceType === 'node' ? 'node.read' : 'entity.read';
  const directScopeNodeIds = new Set(scope.directScopeNodeIds ?? scope.scopeNodeIds.slice(0, 1));
  const allScopeNodeIds = new Set(scope.scopeNodeIds);
  const applies = (rule: RealtimeChannelRule): boolean =>
    rule.permissionKey === permissionKey &&
    (rule.propagation === 'subtree'
      ? allScopeNodeIds.has(rule.nodeId)
      : directScopeNodeIds.has(rule.nodeId));

  const allowed = policy.isGlobal || policy.rules.some((rule) => rule.assignmentEffect === 'allow' && applies(rule));
  const denied = policy.rules.some((rule) => rule.assignmentEffect === 'deny' && applies(rule));
  return allowed && !denied;
}

export function getEventScope(event: RealtimeDataChangedEvent): RealtimeResourceScope {
  const scope: RealtimeResourceScope = { scopeNodeIds: event.scopeNodeIds ?? [] };
  if (event.directScopeNodeIds) scope.directScopeNodeIds = event.directScopeNodeIds;
  return scope;
}
