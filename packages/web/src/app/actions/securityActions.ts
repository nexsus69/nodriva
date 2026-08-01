'use server';

import { securityAdminService } from '../../server/db';
import { AuthResolver } from './auth/AuthResolver';
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
  RowVersionMismatchError,
  RoleNotFoundError,
  RoleKeyAlreadyExistsError,
  SystemRoleForbiddenError,
  SecurityAdminValidationError,
} from '@dashboard/core';


function mapErrorToApiErrorResponse(err: unknown): ApiErrorResponse {
  if (err instanceof RowVersionMismatchError) {
    const expected = typeof err.details?.expected === 'number' ? err.details.expected : undefined;
    const actual = typeof err.details?.actual === 'number' ? err.details.actual : undefined;
    return {
      code: 'ROW_VERSION_MISMATCH',
      message: 'Il ruolo è stato modificato da un altro utente. Ricarica la pagina.',
      expectedRowVersion: expected,
      currentRowVersion: actual,
    };
  }
  if (err instanceof RoleKeyAlreadyExistsError) {
    const key = typeof err.details?.roleKey === 'string' ? err.details.roleKey : '';
    return {
      code: 'DUPLICATE_TYPE_KEY',
      message: `La chiave ruolo '${key}' è già in uso.`,
      target: 'roleKey',
    };
  }
  if (err instanceof RoleNotFoundError) {
    return {
      code: 'NOT_FOUND',
      message: 'Ruolo non trovato.',
    };
  }
  if (err instanceof SystemRoleForbiddenError) {
    return {
      code: 'SYSTEM_TYPE_FORBIDDEN',
      message: 'I ruoli di sistema non possono essere modificati.',
    };
  }
  if (err instanceof SecurityAdminValidationError) {
    const issuesObj = (err.details?.issues as Record<string, string[]> | undefined) ?? {};
    const details = Object.entries(issuesObj).map(([field, msgs]) => ({
      field,
      code: 'VALIDATION_FAILED',
      message: Array.isArray(msgs) ? msgs.join(', ') : String(msgs),
    }));
    return {
      code: 'VALIDATION_ERROR',
      message: err.message,
      details,
    };
  }

  const msg = err instanceof Error ? err.message : String(err);
  return {
    code: 'VALIDATION_ERROR',
    message: msg,
  };
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
    return { success: false, error: mapErrorToApiErrorResponse(err) };
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
