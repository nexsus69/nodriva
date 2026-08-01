'use server';

import { userAdminService } from '../../server/db';
import { AuthResolver } from './auth/AuthResolver';
import {
  CreateUserUiCommand,
  UpdateUserStatusUiCommand,
  AssignUserRolesUiCommand,
  UpdateUserUiCommand,
  ResetUserPasswordUiCommand,
  UserListItemDto,
  UserDetailDto,
  ApiErrorResponse,
  RowVersionMismatchError,
  UserEmailAlreadyExistsError,
  UserNotFoundError,
  UserAdminValidationError,
} from '@dashboard/core';


function mapErrorToApiErrorResponse(err: unknown): ApiErrorResponse {
  if (err instanceof RowVersionMismatchError) {
    const expected = typeof err.details?.expected === 'number' ? err.details.expected : undefined;
    const actual = typeof err.details?.actual === 'number' ? err.details.actual : undefined;
    return {
      code: 'ROW_VERSION_MISMATCH',
      message: 'L\'utente è stato modificato da un altro utente. Ricarica la pagina.',
      expectedRowVersion: expected,
      currentRowVersion: actual,
    };
  }
  if (err instanceof UserEmailAlreadyExistsError) {
    const email = typeof err.details?.email === 'string' ? err.details.email : '';
    return {
      code: 'DUPLICATE_EMAIL',
      message: `L'email '${email}' è già associata a un utente registrato.`,
      target: 'email',
    };
  }
  if (err instanceof UserNotFoundError) {
    return {
      code: 'NOT_FOUND',
      message: 'Utente non trovato.',
    };
  }
  if (err instanceof UserAdminValidationError) {
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
