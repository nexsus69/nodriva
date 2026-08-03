import {
  getEventScope,
  getRealtimeDataChannelName,
  getRealtimeLockChannelName,
  policyAllowsResource,
  type RealtimeChannelPolicy,
  type RealtimeResourceScope,
} from '../../application/realtime/RealtimeChannelPolicy.js';
import type { RealtimeDataChangedEvent, RealtimeResourceType } from '../../application/ports/RealtimeEventBus.js';

export class RealtimeChannelRouter {
  private readonly policiesByChannelId = new Map<string, RealtimeChannelPolicy>();
  private readonly policiesByRule = new Map<string, Set<string>>();
  private readonly globalPolicyIds = new Set<string>();

  constructor(private readonly policies: RealtimeChannelPolicy[]) {
    for (const policy of policies) {
      this.policiesByChannelId.set(policy.channelId, policy);
      if (policy.isGlobal) this.globalPolicyIds.add(policy.channelId);
      for (const rule of policy.rules) {
        const key = `${rule.permissionKey}:${rule.nodeId}`;
        const entries = this.policiesByRule.get(key) ?? new Set<string>();
        entries.add(policy.channelId);
        this.policiesByRule.set(key, entries);
      }
    }
  }

  dataChannels(event: RealtimeDataChangedEvent): string[] {
    const scope = getEventScope(event);
    return this.matchingPolicies(event.resourceType, scope)
      .map(getRealtimeDataChannelName);
  }

  lockChannels(resourceType: RealtimeResourceType, scope: RealtimeResourceScope): string[] {
    return this.matchingPolicies(resourceType, scope)
      .map(getRealtimeLockChannelName);
  }

  private matchingPolicies(resourceType: RealtimeResourceType, scope: RealtimeResourceScope): RealtimeChannelPolicy[] {
    const permissionKey = resourceType === 'node' ? 'node.read' : 'entity.read';
    const candidateIds = new Set(this.globalPolicyIds);
    for (const nodeId of scope.scopeNodeIds) {
      this.policiesByRule.get(`${permissionKey}:${nodeId}`)?.forEach((policyId) => candidateIds.add(policyId));
    }
    for (const nodeId of scope.directScopeNodeIds ?? []) {
      this.policiesByRule.get(`${permissionKey}:${nodeId}`)?.forEach((policyId) => candidateIds.add(policyId));
    }

    return [...candidateIds]
      .map((policyId) => this.policiesByChannelId.get(policyId))
      .filter((policy): policy is RealtimeChannelPolicy => Boolean(policy))
      .filter((policy) => policyAllowsResource(policy, resourceType, scope));
  }
}
