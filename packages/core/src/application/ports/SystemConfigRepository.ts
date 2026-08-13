import type {
  RuntimeCapabilityDto,
  SystemSettingDto,
  PlacementPolicyListItemDto,
  PlacementPolicyDetailDto,
  CapabilityStatus,
  PolicyMode,
} from '../dto/SystemConfigDtos.js';

export interface SystemConfigRepository {
  listCapabilities(): Promise<RuntimeCapabilityDto[]>;
  updateCapabilityStatus(
    capabilityKey: string,
    status: CapabilityStatus,
    actorUserId: string
  ): Promise<string | null>;
  listSettings(): Promise<SystemSettingDto[]>;
  updateSetting(
    settingKey: string,
    valueText: string,
    expectedRowVersion: number,
    actorUserId: string
  ): Promise<string | null>;
  listPlacementPolicies(): Promise<PlacementPolicyListItemDto[]>;
  getPlacementPolicyByKey(policyKey: string): Promise<PlacementPolicyDetailDto | null>;
  findPlacementPolicyByKey(
    policyKey: string
  ): Promise<{ id: string; policyKey: string; name: string; description: string; policyMode: PolicyMode; rowVersion: number } | null>;
  createPlacementPolicy(
    id: string,
    policyKey: string,
    name: string,
    description: string,
    policyMode: PolicyMode
  ): Promise<void>;
  updatePlacementPolicy(
    policyKey: string,
    name: string,
    description: string,
    policyMode: PolicyMode,
    expectedRowVersion: number
  ): Promise<string>;
  deletePlacementPolicy(
    policyKey: string,
    expectedRowVersion: number
  ): Promise<string>;
  createPlacementRule(
    id: string,
    placementPolicyId: string,
    ruleType: string,
    targetNodeId: string | null,
    targetNodeTypeId: string | null,
    comparator: string | null,
    valueText: string | null
  ): Promise<void>;
  deletePlacementRule(ruleId: string): Promise<void>;
}
