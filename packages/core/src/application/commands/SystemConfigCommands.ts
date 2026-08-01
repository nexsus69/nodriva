import { z } from 'zod';

export const UpdateCapabilityStatusCommandSchema = z.object({
  capabilityKey: z.string().min(2).max(100),
  status: z.enum(['enabled', 'disabled', 'optional']),
  actorUserId: z.string().uuid(),
});
export type UpdateCapabilityStatusCommand = z.infer<typeof UpdateCapabilityStatusCommandSchema>;

export const UpdateSystemSettingCommandSchema = z.object({
  settingKey: z.string().min(2).max(150),
  settingValueText: z.string(),
  expectedRowVersion: z.number().int().min(1),
  actorUserId: z.string().uuid(),
});
export type UpdateSystemSettingCommand = z.infer<typeof UpdateSystemSettingCommandSchema>;

export const CreatePlacementPolicyCommandSchema = z.object({
  policyKey: z.string().min(2).max(100).regex(/^[a-z0-9_]+$/),
  name: z.string().min(2).max(150),
  description: z.string().max(500).optional(),
  policyMode: z.enum(['allow_all', 'deny_all', 'node_type_whitelist', 'node_subtree_whitelist', 'custom_rule']),
  actorUserId: z.string().uuid(),
});
export type CreatePlacementPolicyCommand = z.infer<typeof CreatePlacementPolicyCommandSchema>;

export const UpdatePlacementPolicyCommandSchema = z.object({
  policyKey: z.string().min(2).max(100),
  name: z.string().min(2).max(150),
  description: z.string().max(500).optional(),
  policyMode: z.enum(['allow_all', 'deny_all', 'node_type_whitelist', 'node_subtree_whitelist', 'custom_rule']),
  expectedRowVersion: z.number().int().min(1),
  actorUserId: z.string().uuid(),
});
export type UpdatePlacementPolicyCommand = z.infer<typeof UpdatePlacementPolicyCommandSchema>;

export const DeletePlacementPolicyCommandSchema = z.object({
  policyKey: z.string().min(2).max(100),
  expectedRowVersion: z.number().int().min(1),
  actorUserId: z.string().uuid(),
});
export type DeletePlacementPolicyCommand = z.infer<typeof DeletePlacementPolicyCommandSchema>;

export const CreatePlacementRuleCommandSchema = z.object({
  policyKey: z.string().min(2).max(100),
  ruleType: z.enum(['allow_node_type', 'deny_node_type', 'allow_node', 'deny_node', 'allow_subtree', 'deny_subtree']),
  targetNodeId: z.string().uuid().optional(),
  targetNodeTypeId: z.string().uuid().optional(),
  comparator: z.string().max(30).optional(),
  valueText: z.string().optional(),
  actorUserId: z.string().uuid(),
});
export type CreatePlacementRuleCommand = z.infer<typeof CreatePlacementRuleCommandSchema>;

export const DeletePlacementRuleCommandSchema = z.object({
  ruleId: z.string().uuid(),
  actorUserId: z.string().uuid(),
});
export type DeletePlacementRuleCommand = z.infer<typeof DeletePlacementRuleCommandSchema>;
