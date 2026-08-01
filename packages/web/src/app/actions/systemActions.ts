'use server';

import { systemAdminService } from '../../server/db';
import { AuthResolver } from './auth/AuthResolver';
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
  RowVersionMismatchError,
  PlacementPolicyNotFoundError,
  PlacementPolicyKeyAlreadyExistsError,
  SystemConfigValidationError,
} from '@dashboard/core';


function mapErrorToApiErrorResponse(err: unknown): ApiErrorResponse {
  if (err instanceof PlacementPolicyNotFoundError) {
    return { message: err.message, code: 'PLACEMENT_POLICY_NOT_FOUND' };
  }
  if (err instanceof PlacementPolicyKeyAlreadyExistsError) {
    return { message: err.message, code: 'DUPLICATE_PLACEMENT_POLICY_KEY' };
  }
  if (err instanceof RowVersionMismatchError) {
    return { message: err.message, code: 'ROW_VERSION_MISMATCH' };
  }
  if (err instanceof SystemConfigValidationError) {
    return { message: err.message, code: 'VALIDATION_ERROR' };
  }
  if (err instanceof Error) {
    return { message: err.message, code: 'INTERNAL_ERROR' };
  }
  return { message: 'Si è verificato un errore imprevisto.', code: 'UNKNOWN_ERROR' };
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

export async function updateCapabilityStatusAction(cmd: UpdateCapabilityStatusUiCommand): Promise<{
  success: boolean;
  error?: ApiErrorResponse;
}> {
  try {
    await systemAdminService.updateCapabilityStatus({
      capabilityKey: cmd.capabilityKey,
      status: cmd.status,
      actorUserId: await AuthResolver.resolveActorUserId(),
    });
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
    await systemAdminService.updateSetting({
      settingKey: cmd.settingKey,
      settingValueText: cmd.settingValueText,
      expectedRowVersion: cmd.expectedRowVersion,
      actorUserId: await AuthResolver.resolveActorUserId(),
    });
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
    const data = await systemAdminService.createPlacementPolicy({
      policyKey: cmd.policyKey,
      name: cmd.name,
      description: cmd.description,
      policyMode: cmd.policyMode,
      actorUserId: await AuthResolver.resolveActorUserId(),
    });
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
    const data = await systemAdminService.updatePlacementPolicy({
      policyKey: cmd.policyKey,
      name: cmd.name,
      description: cmd.description,
      policyMode: cmd.policyMode,
      expectedRowVersion: cmd.expectedRowVersion,
      actorUserId: await AuthResolver.resolveActorUserId(),
    });
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
    await systemAdminService.deletePlacementPolicy({
      policyKey: cmd.policyKey,
      expectedRowVersion: cmd.expectedRowVersion,
      actorUserId: await AuthResolver.resolveActorUserId(),
    });
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
    await systemAdminService.createPlacementRule({
      policyKey: cmd.policyKey,
      ruleType: cmd.ruleType,
      targetNodeId: cmd.targetNodeId,
      targetNodeTypeId: cmd.targetNodeTypeId,
      comparator: cmd.comparator,
      valueText: cmd.valueText,
      actorUserId: await AuthResolver.resolveActorUserId(),
    });
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
    await systemAdminService.deletePlacementRule({
      ruleId: cmd.ruleId,
      actorUserId: await AuthResolver.resolveActorUserId(),
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}
