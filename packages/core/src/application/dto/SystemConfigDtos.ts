export type CapabilityStatus = 'enabled' | 'disabled' | 'optional';
export type SettingValueType = 'string' | 'integer' | 'boolean' | 'decimal' | 'json';
export type PolicyMode = 'allow_all' | 'deny_all' | 'node_type_whitelist' | 'node_subtree_whitelist' | 'custom_rule';
export type RuleType = 'allow_node_type' | 'deny_node_type' | 'allow_node' | 'deny_node' | 'allow_subtree' | 'deny_subtree';

export interface RuntimeCapabilityDto {
  id: string;
  capabilityKey: string;
  name: string;
  description: string;
  defaultStatus: CapabilityStatus;
  currentStatus: CapabilityStatus;
  isSystem: boolean;
  updatedAt: string;
}

export interface SystemSettingDto {
  id: string;
  category: string;
  settingKey: string;
  displayName: string;
  description: string;
  valueType: SettingValueType;
  valueText: string | null;
  isSecret: boolean;
  isSystem: boolean;
  rowVersion: number;
  updatedAt: string;
}

export interface PlacementPolicyRuleDto {
  id: string;
  placementPolicyId: string;
  ruleType: string;
  targetNodeId: string | null;
  targetNodeName: string | null;
  targetNodeTypeId: string | null;
  targetNodeTypeName: string | null;
  comparator: string | null;
  valueText: string | null;
  createdAt: string;
}

export interface PlacementPolicyListItemDto {
  id: string;
  policyKey: string;
  name: string;
  description: string;
  policyMode: PolicyMode;
  rowVersion: number;
  ruleCount: number;
  updatedAt: string;
}

export interface PlacementPolicyDetailDto {
  id: string;
  policyKey: string;
  name: string;
  description: string;
  policyMode: PolicyMode;
  rowVersion: number;
  rules: PlacementPolicyRuleDto[];
  updatedAt: string;
}

export interface UpdateCapabilityStatusUiCommand {
  capabilityKey: string;
  status: CapabilityStatus;
}

export interface UpdateSystemSettingUiCommand {
  settingKey: string;
  settingValueText: string;
  expectedRowVersion: number;
}

export interface CreatePlacementPolicyUiCommand {
  policyKey: string;
  name: string;
  description?: string;
  policyMode: PolicyMode;
}

export interface UpdatePlacementPolicyUiCommand {
  policyKey: string;
  name: string;
  description?: string;
  policyMode: PolicyMode;
  expectedRowVersion: number;
}

export interface DeletePlacementPolicyUiCommand {
  policyKey: string;
  expectedRowVersion: number;
}

export interface CreatePlacementRuleUiCommand {
  policyKey: string;
  ruleType: RuleType;
  targetNodeId?: string;
  targetNodeTypeId?: string;
  comparator?: string;
  valueText?: string;
}

export interface DeletePlacementRuleUiCommand {
  ruleId: string;
}
