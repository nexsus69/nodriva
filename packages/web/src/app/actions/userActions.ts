'use server';

import { userAdminService } from '../../server/db';
import { AuthResolver } from './auth/AuthResolver';
import { mapAppErrorToApiErrorResponse } from './errorMapping';
import {
  CreateUserUiCommand,
  UpdateUserStatusUiCommand,
  AssignUserRolesUiCommand,
  UpdateUserUiCommand,
  ResetUserPasswordUiCommand,
  UserListItemDto,
  UserDetailDto,
  ApiErrorResponse,
  CreateScopedUserCommand,
} from '@dashboard/core';


function mapErrorToApiErrorResponse(err: unknown): ApiErrorResponse {
  return mapAppErrorToApiErrorResponse(err);
}

export async function listUsersAction(): Promise<{
  success: boolean;
  data?: UserListItemDto[];
  error?: ApiErrorResponse;
}> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    const data = await userAdminService.listUsers(actorUserId);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

export async function getUserByIdAction(userId: string): Promise<{
  success: boolean;
  data?: UserDetailDto;
  error?: ApiErrorResponse;
}> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    const data = await userAdminService.getUserById(actorUserId, userId);
    if (!data) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Utente non trovato.' } };
    }
    return { success: true, data };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

export async function createUserAction(cmd: CreateUserUiCommand): Promise<{
  success: boolean;
  data?: UserDetailDto;
  error?: ApiErrorResponse;
}> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    const user = await userAdminService.createUser({
      email: cmd.email,
      password: cmd.password,
      isSuperAdmin: cmd.isSuperAdmin,
      roleIds: cmd.roleIds,
      actorUserId,
    });
    const res = await userAdminService.getUserById(actorUserId, user.id);
    return { success: true, data: res ?? undefined };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

/** Creates an identity together with its local grants in one transaction. */
export async function createScopedUserAction(cmd: Omit<CreateScopedUserCommand, 'actorUserId'>): Promise<{
  success: boolean;
  data?: { id: string; email: string };
  error?: ApiErrorResponse;
}> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    const { scopedUserProvisioningService } = await import('../../server/db');
    const user = await scopedUserProvisioningService.createScopedUser({ ...cmd, actorUserId });
    return { success: true, data: { id: user.id, email: user.email } };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

export async function updateUserStatusAction(cmd: UpdateUserStatusUiCommand): Promise<{
  success: boolean;
  data?: UserDetailDto;
  error?: ApiErrorResponse;
}> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    const user = await userAdminService.updateUserStatus({
      userId: cmd.userId,
      isActive: cmd.isActive,
      expectedRowVersion: cmd.expectedRowVersion,
      actorUserId,
    });
    const res = await userAdminService.getUserById(actorUserId, user.id);
    return { success: true, data: res ?? undefined };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

export async function assignUserRolesAction(cmd: AssignUserRolesUiCommand): Promise<{
  success: boolean;
  data?: UserDetailDto;
  error?: ApiErrorResponse;
}> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    await userAdminService.assignUserRoles({
      userId: cmd.userId,
      roleIds: cmd.roleIds,
      expectedRowVersion: cmd.expectedRowVersion,
      actorUserId,
    });
    const res = await userAdminService.getUserById(actorUserId, cmd.userId);
    return { success: true, data: res ?? undefined };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

export async function updateUserAction(cmd: UpdateUserUiCommand): Promise<{
  success: boolean;
  data?: UserDetailDto;
  error?: ApiErrorResponse;
}> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    const user = await userAdminService.updateUser({
      userId: cmd.userId,
      email: cmd.email,
      isSuperAdmin: cmd.isSuperAdmin,
      expectedRowVersion: cmd.expectedRowVersion,
      actorUserId,
    });
    const res = await userAdminService.getUserById(actorUserId, user.id);
    return { success: true, data: res ?? undefined };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

export async function resetUserPasswordAction(cmd: ResetUserPasswordUiCommand): Promise<{
  success: boolean;
  data?: UserDetailDto;
  error?: ApiErrorResponse;
}> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    const user = await userAdminService.resetUserPassword({
      userId: cmd.userId,
      newPassword: cmd.newPassword,
      expectedRowVersion: cmd.expectedRowVersion,
      actorUserId,
    });
    const res = await userAdminService.getUserById(actorUserId, user.id);
    return { success: true, data: res ?? undefined };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}
