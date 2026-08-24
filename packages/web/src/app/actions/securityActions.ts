'use server';

/** Adapts security administration UI commands to authenticated application services. */
import { securityAdminService } from '../../server/db';
import { AuthResolver } from './auth/AuthResolver';
import { mapAppErrorToApiErrorResponse } from './errorMapping';
import {
  CreateRoleUiCommand,
  UpdateRolePermissionsUiCommand,
  UpdateRoleMetadataUiCommand,
  UpdateRoleUiCommand,
  CreateScopeAssignmentUiCommand,
  DeleteScopeAssignmentUiCommand,
  UpdateScopeAssignmentUiCommand,
  RoleListItemDto,
  RoleDetailDto,
  PermissionDto,
  ScopeAssignmentDto,
  ApiErrorResponse,
} from '@dashboard/core';
import { publishAdministrativeChange } from '../../server/adminRealtime';
import { withAdministrativeMutationLock } from '../../server/adminMutationLock';

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
    const role = await withAdministrativeMutationLock({ resourceType: 'role', resourceId: cmd.roleKey, permission: 'role.create', work: async () => securityAdminService.createRole({
      roleKey: cmd.roleKey,
      name: cmd.name,
      description: cmd.description,
      permissionIds: cmd.permissionIds,
      actorUserId,
    }) });
    const res = await securityAdminService.getRoleByKey(actorUserId, role.roleKey);
    await publishAdministrativeChange({ resourceType: 'role', resourceId: role.id, changeType: 'created', actorUserId, data: res ?? undefined });
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
    const role = await securityAdminService.getRoleByKey(actorUserId, cmd.roleKey);
    if (!role) return { success: false, error: { code: 'NOT_FOUND', message: 'Ruolo non trovato.' } };
    await withAdministrativeMutationLock({ resourceType: 'role', resourceId: role.id, permission: 'role.update', work: async () => securityAdminService.updateRolePermissions({
      roleKey: cmd.roleKey,
      permissionIds: cmd.permissionIds,
      expectedRowVersion: cmd.expectedRowVersion,
      actorUserId,
    }) });
    const res = await securityAdminService.getRoleByKey(actorUserId, cmd.roleKey);
    await publishAdministrativeChange({ resourceType: 'role', resourceId: res?.id ?? cmd.roleKey, changeType: 'updated', actorUserId, data: res ?? undefined });
    return { success: true, data: res ?? undefined };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

export async function updateRoleMetadataAction(cmd: UpdateRoleMetadataUiCommand): Promise<{
  success: boolean;
  data?: RoleDetailDto;
  error?: ApiErrorResponse;
}> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    await withAdministrativeMutationLock({ resourceType: 'role', resourceId: cmd.roleKey, permission: 'role.update', work: async () => securityAdminService.updateRoleMetadata({ ...cmd, actorUserId }) });
    const data = await securityAdminService.getRoleByKey(actorUserId, cmd.roleKey);
    await publishAdministrativeChange({ resourceType: 'role', resourceId: data?.id ?? cmd.roleKey, changeType: 'updated', actorUserId, data: data ?? undefined });
    return { success: true, data: data ?? undefined };
  } catch (err) {
    return { success: false, error: mapAppErrorToApiErrorResponse(err) };
  }
}

/** Updates all editable role fields through one transaction and one realtime event. */
export async function updateRoleAction(cmd: UpdateRoleUiCommand): Promise<{
  success: boolean;
  data?: RoleDetailDto;
  error?: ApiErrorResponse;
}> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    const current = await securityAdminService.getRoleByKey(actorUserId, cmd.roleKey);
    if (!current) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Role not found.' } };
    }
    await withAdministrativeMutationLock({
      resourceType: 'role',
      resourceId: current.id,
      permission: 'role.update',
      work: async () => securityAdminService.updateRole({ ...cmd, actorUserId }),
    });
    const data = await securityAdminService.getRoleByKey(actorUserId, cmd.roleKey);
    await publishAdministrativeChange({
      resourceType: 'role',
      resourceId: current.id,
      changeType: 'updated',
      actorUserId,
      data: data ?? undefined,
    });
    return { success: true, data: data ?? undefined };
  } catch (err) {
    return { success: false, error: mapAppErrorToApiErrorResponse(err) };
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
    const actorUserId = await AuthResolver.resolveActorUserId();
    await withAdministrativeMutationLock({ resourceType: 'scope_assignment', resourceId: `${cmd.userId}:${cmd.nodeId}:${cmd.roleId}`, permission: 'scope.assign', work: async () => securityAdminService.createScopeAssignment({
      userId: cmd.userId,
      nodeId: cmd.nodeId,
      roleId: cmd.roleId,
      assignmentEffect: cmd.assignmentEffect,
      propagation: cmd.propagation,
      actorUserId,
    }) });
    await publishAdministrativeChange({ resourceType: 'scope', resourceId: `${cmd.userId}:${cmd.nodeId}:${cmd.roleId}`, changeType: 'created', actorUserId, data: cmd });
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
    const actorUserId = await AuthResolver.resolveActorUserId();
    await withAdministrativeMutationLock({ resourceType: 'scope_assignment', resourceId: cmd.assignmentId, permission: 'scope.delete', work: async () => securityAdminService.deleteScopeAssignment({
      assignmentId: cmd.assignmentId,
      actorUserId,
    }) });
    await publishAdministrativeChange({ resourceType: 'scope', resourceId: cmd.assignmentId, changeType: 'deleted', actorUserId });
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
    const actorUserId = await AuthResolver.resolveActorUserId();
    await withAdministrativeMutationLock({ resourceType: 'scope_assignment', resourceId: cmd.assignmentId, permission: 'scope.assign', work: async () => securityAdminService.updateScopeAssignment({
      assignmentId: cmd.assignmentId,
      roleId: cmd.roleId,
      assignmentEffect: cmd.assignmentEffect,
      propagation: cmd.propagation,
      actorUserId,
    }) });
    await publishAdministrativeChange({ resourceType: 'scope', resourceId: cmd.assignmentId, changeType: 'updated', actorUserId, data: cmd });
    return { success: true };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}
