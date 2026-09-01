'use server';

import { configService, serviceAdministrationService, systemAdminService } from '../../server/db';
import { AuthResolver } from './auth/AuthResolver';
import { mapAppErrorToApiErrorResponse } from './errorMapping';
import {
  RuntimeCapabilityDto,
  SystemSettingDto,
  PlacementPolicyListItemDto,
  PlacementPolicyDetailDto,
  UpdateCapabilityStatusUiCommand,
  UpdateSystemSettingUiCommand,
  CreatePlacementPolicyUiCommand,
  UpdatePlacementPolicyUiCommand,
  DeletePlacementPolicyUiCommand,
  CreatePlacementRuleUiCommand,
  DeletePlacementRuleUiCommand,
  ApiErrorResponse,
  PublicServiceConfiguration,
  ServiceConfigurationKey,
  ServiceHealthCheckResult,
} from '@dashboard/core';
import { publishAdministrativeChange } from '../../server/adminRealtime';
import { withAdministrativeMutationLock } from '../../server/adminMutationLock';


function mapErrorToApiErrorResponse(err: unknown): ApiErrorResponse {
  return mapAppErrorToApiErrorResponse(err);
}

export async function listCapabilitiesAction(): Promise<{
  success: boolean;
  data?: RuntimeCapabilityDto[];
  error?: ApiErrorResponse;
}> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    const data = await systemAdminService.listCapabilities(actorUserId);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

/** Returns only the authorized, redacted service catalogue for Platform views. */
export async function listServiceConfigurationsAction(): Promise<{
  success: boolean;
  data?: readonly PublicServiceConfiguration[];
  error?: ApiErrorResponse;
}> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    return { success: true, data: await serviceAdministrationService.list(actorUserId) };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

/** Runs a non-mutating, authorized health probe; it never returns deployment values or secrets. */
export async function checkServiceHealthAction(serviceKey: ServiceConfigurationKey): Promise<{
  success: boolean;
  data?: ServiceHealthCheckResult;
  error?: ApiErrorResponse;
}> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    return { success: true, data: await serviceAdministrationService.checkHealth(actorUserId, serviceKey) };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

export async function updateCapabilityStatusAction(cmd: UpdateCapabilityStatusUiCommand): Promise<{
  success: boolean;
  error?: ApiErrorResponse;
}> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    await withAdministrativeMutationLock({ resourceType: 'runtime_capability', resourceId: cmd.capabilityKey, permission: 'system.config', work: async () => systemAdminService.updateCapabilityStatus({
      capabilityKey: cmd.capabilityKey,
      status: cmd.status,
      actorUserId,
    }) });
    await publishAdministrativeChange({ resourceType: 'system', resourceId: cmd.capabilityKey, changeType: 'updated', actorUserId, data: { capabilityKey: cmd.capabilityKey, status: cmd.status } });
    return { success: true };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

export async function listSettingsAction(): Promise<{
  success: boolean;
  data?: SystemSettingDto[];
  error?: ApiErrorResponse;
}> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    const data = await systemAdminService.listSettings(actorUserId);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

export async function updateSettingAction(cmd: UpdateSystemSettingUiCommand): Promise<{
  success: boolean;
  error?: ApiErrorResponse;
}> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    await withAdministrativeMutationLock({ resourceType: 'system_setting', resourceId: cmd.settingKey, permission: 'system.config', work: async () => systemAdminService.updateSetting({
      settingKey: cmd.settingKey,
      settingValueText: cmd.settingValueText,
      expectedRowVersion: cmd.expectedRowVersion,
      actorUserId,
    }) });
    configService.invalidate(cmd.settingKey);
    await publishAdministrativeChange({ resourceType: 'system', resourceId: cmd.settingKey, changeType: 'updated', actorUserId, data: { settingKey: cmd.settingKey } });
    return { success: true };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

export async function listPlacementPoliciesAction(): Promise<{
  success: boolean;
  data?: PlacementPolicyListItemDto[];
  error?: ApiErrorResponse;
}> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    const data = await systemAdminService.listPlacementPolicies(actorUserId);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

export async function getPlacementPolicyByKeyAction(policyKey: string): Promise<{
  success: boolean;
  data?: PlacementPolicyDetailDto;
  error?: ApiErrorResponse;
}> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    const data = await systemAdminService.getPlacementPolicyByKey(actorUserId, policyKey);
    if (!data) {
      return { success: false, error: { message: `Placement policy '${policyKey}' non trovata.`, code: 'PLACEMENT_POLICY_NOT_FOUND' } };
    }
    return { success: true, data };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

export async function createPlacementPolicyAction(cmd: CreatePlacementPolicyUiCommand): Promise<{
  success: boolean;
  data?: PlacementPolicyDetailDto;
  error?: ApiErrorResponse;
}> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    const data = await withAdministrativeMutationLock({ resourceType: 'placement_policy', resourceId: cmd.policyKey, permission: 'system.config', work: async () => systemAdminService.createPlacementPolicy({
      policyKey: cmd.policyKey,
      name: cmd.name,
      description: cmd.description,
      policyMode: cmd.policyMode,
      actorUserId,
    }) });
    await publishAdministrativeChange({ resourceType: 'placement_policy', resourceId: cmd.policyKey, changeType: 'created', actorUserId, data });
    return { success: true, data };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

export async function updatePlacementPolicyAction(cmd: UpdatePlacementPolicyUiCommand): Promise<{
  success: boolean;
  data?: PlacementPolicyDetailDto;
  error?: ApiErrorResponse;
}> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    const data = await withAdministrativeMutationLock({ resourceType: 'placement_policy', resourceId: cmd.policyKey, permission: 'system.config', work: async () => systemAdminService.updatePlacementPolicy({
      policyKey: cmd.policyKey,
      name: cmd.name,
      description: cmd.description,
      policyMode: cmd.policyMode,
      expectedRowVersion: cmd.expectedRowVersion,
      actorUserId,
    }) });
    await publishAdministrativeChange({ resourceType: 'placement_policy', resourceId: cmd.policyKey, changeType: 'updated', actorUserId, data });
    return { success: true, data };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

export async function deletePlacementPolicyAction(cmd: DeletePlacementPolicyUiCommand): Promise<{
  success: boolean;
  error?: ApiErrorResponse;
}> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    await withAdministrativeMutationLock({ resourceType: 'placement_policy', resourceId: cmd.policyKey, permission: 'system.config', work: async () => systemAdminService.deletePlacementPolicy({
      policyKey: cmd.policyKey,
      expectedRowVersion: cmd.expectedRowVersion,
      actorUserId,
    }) });
    await publishAdministrativeChange({ resourceType: 'placement_policy', resourceId: cmd.policyKey, changeType: 'deleted', actorUserId });
    return { success: true };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

export async function createPlacementRuleAction(cmd: CreatePlacementRuleUiCommand): Promise<{
  success: boolean;
  error?: ApiErrorResponse;
}> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    await withAdministrativeMutationLock({ resourceType: 'placement_policy', resourceId: cmd.policyKey, permission: 'system.config', work: async () => systemAdminService.createPlacementRule({
      policyKey: cmd.policyKey,
      ruleType: cmd.ruleType,
      targetNodeId: cmd.targetNodeId,
      targetNodeTypeId: cmd.targetNodeTypeId,
      comparator: cmd.comparator,
      valueText: cmd.valueText,
      actorUserId,
    }) });
    await publishAdministrativeChange({ resourceType: 'placement_policy', resourceId: cmd.policyKey, changeType: 'updated', actorUserId, data: { ruleType: cmd.ruleType, targetNodeId: cmd.targetNodeId, targetNodeTypeId: cmd.targetNodeTypeId } });
    return { success: true };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

export async function deletePlacementRuleAction(cmd: DeletePlacementRuleUiCommand): Promise<{
  success: boolean;
  error?: ApiErrorResponse;
}> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    await withAdministrativeMutationLock({ resourceType: 'placement_policy', resourceId: cmd.ruleId, permission: 'system.config', work: async () => systemAdminService.deletePlacementRule({
      ruleId: cmd.ruleId,
      actorUserId,
    }) });
    await publishAdministrativeChange({ resourceType: 'placement_policy', resourceId: cmd.ruleId, changeType: 'updated', actorUserId });
    return { success: true };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}
