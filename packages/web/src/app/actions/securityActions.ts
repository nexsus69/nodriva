'use server';

import { securityAdminService } from '../../server/db';
import { AuthResolver } from './auth/AuthResolver';
import { mapAppErrorToApiErrorResponse } from './errorMapping';
import {
  CreateRoleUiCommand,
  UpdateRolePermissionsUiCommand,
  CreateScopeAssignmentUiCommand,
  DeleteScopeAssignmentUiCommand,
  UpdateScopeAssignmentUiCommand,
  RoleListItemDto,
  RoleDetailDto,
  PermissionDto,
  ScopeAssignmentDto,
  ApiErrorResponse,
} from '@dashboard/core';

function mapErrorToApiErrorResponse(err: unknown): ApiErrorResponse {
  return mapAppErrorToApiErrorResponse(err);
}


export async function listRolesAction(): Promise<{
  success: boolean;
  data?: RoleListItemDto[];
  error?: ApiErrorResponse;
}> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    const data = await securityAdminService.listRoles(actorUserId);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: mapAppErrorToApiErrorResponse(err) };
  }
}

export async function getRoleByKeyAction(roleKey: string): Promise<{
  success: boolean;
  data?: RoleDetailDto;
  error?: ApiErrorResponse;
}> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    const data = await securityAdminService.getRoleByKey(actorUserId, roleKey);
    if (!data) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Ruolo non trovato.' } };
    }
    return { success: true, data };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

export async function createRoleAction(cmd: CreateRoleUiCommand): Promise<{
  success: boolean;
  data?: RoleDetailDto;
  error?: ApiErrorResponse;
}> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    const role = await securityAdminService.createRole({
      roleKey: cmd.roleKey,
      name: cmd.name,
      description: cmd.description,
      permissionIds: cmd.permissionIds,
      actorUserId,
    });
    const res = await securityAdminService.getRoleByKey(actorUserId, role.roleKey);
    return { success: true, data: res ?? undefined };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

export async function updateRolePermissionsAction(cmd: UpdateRolePermissionsUiCommand): Promise<{
  success: boolean;
  data?: RoleDetailDto;
  error?: ApiErrorResponse;
}> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    await securityAdminService.updateRolePermissions({
      roleKey: cmd.roleKey,
      permissionIds: cmd.permissionIds,
      expectedRowVersion: cmd.expectedRowVersion,
      actorUserId,
    });
    const res = await securityAdminService.getRoleByKey(actorUserId, cmd.roleKey);
    return { success: true, data: res ?? undefined };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

export async function listPermissionsAction(): Promise<{
  success: boolean;
  data?: PermissionDto[];
  error?: ApiErrorResponse;
}> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    const data = await securityAdminService.listPermissions(actorUserId);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

export async function listScopeAssignmentsAction(): Promise<{
  success: boolean;
  data?: ScopeAssignmentDto[];
  error?: ApiErrorResponse;
}> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    const data = await securityAdminService.listScopeAssignments(actorUserId);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

export async function createScopeAssignmentAction(cmd: CreateScopeAssignmentUiCommand): Promise<{
  success: boolean;
  error?: ApiErrorResponse;
}> {
  try {
    await securityAdminService.createScopeAssignment({
      userId: cmd.userId,
      nodeId: cmd.nodeId,
      roleId: cmd.roleId,
      assignmentEffect: cmd.assignmentEffect,
      propagation: cmd.propagation,
      actorUserId: await AuthResolver.resolveActorUserId(),
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

export async function deleteScopeAssignmentAction(cmd: DeleteScopeAssignmentUiCommand): Promise<{
  success: boolean;
  error?: ApiErrorResponse;
}> {
  try {
    await securityAdminService.deleteScopeAssignment({
      assignmentId: cmd.assignmentId,
      actorUserId: await AuthResolver.resolveActorUserId(),
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

export async function updateScopeAssignmentAction(cmd: UpdateScopeAssignmentUiCommand): Promise<{
  success: boolean;
  error?: ApiErrorResponse;
}> {
  try {
    await securityAdminService.updateScopeAssignment({
      assignmentId: cmd.assignmentId,
      roleId: cmd.roleId,
      assignmentEffect: cmd.assignmentEffect,
      propagation: cmd.propagation,
      actorUserId: await AuthResolver.resolveActorUserId(),
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}
