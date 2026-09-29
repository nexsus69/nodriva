'use server';

import { authApplicationService, userAdminService } from '../../server/db';
import { AuthResolver } from './auth/AuthResolver';
import { mapAppErrorToApiErrorResponse } from './errorMapping';
import {
  CreateUserUiCommand,
  UpdateUserStatusUiCommand,
  AssignUserRolesUiCommand,
  UpdateUserUiCommand,
  ResetUserPasswordUiCommand,
  UserListItemDto,
  UserListPageDto,
  UserListPageParams,
  UserDetailDto,
  ApiErrorResponse,
  CreateScopedUserCommand,
} from '@dashboard/core';
import { publishAdministrativeChange } from '../../server/adminRealtime';
import { withAdministrativeMutationLock } from '../../server/adminMutationLock';


function mapErrorToApiErrorResponse(err: unknown): ApiErrorResponse {
  return mapAppErrorToApiErrorResponse(err);
}

/** Bounded user catalogue; authorization and validation are enforced server-side. */
export async function listUsersPageAction(input: UserListPageParams): Promise<{
  success: boolean;
  data?: UserListPageDto;
  error?: ApiErrorResponse;
}> {
  try {
    if (!Number.isInteger(input.page) || input.page < 1 || !Number.isInteger(input.pageSize) || input.pageSize < 1 || input.pageSize > 100) throw new Error('Paginazione non valida');
    if (input.search && input.search.length > 200) throw new Error('Ricerca troppo lunga');
    if (input.sort && !['email', 'status', 'createdAt'].includes(input.sort.key)) throw new Error('Ordinamento non valido');
    if (input.sort && !['ascending', 'descending'].includes(input.sort.direction)) throw new Error('Direzione ordinamento non valida');
    const actorUserId = await AuthResolver.resolveActorUserId();
    return { success: true, data: await userAdminService.listUsersPage(actorUserId, input) };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
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
    await publishAdministrativeChange({ resourceType: 'user', resourceId: user.id, changeType: 'created', actorUserId, data: res ?? undefined });
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
    await publishAdministrativeChange({ resourceType: 'user', resourceId: user.id, changeType: 'created', actorUserId, data: { id: user.id, email: user.email } });
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
    const user = await withAdministrativeMutationLock({ resourceType: 'user', resourceId: cmd.userId, permission: 'user.update', work: async () => userAdminService.updateUserStatus({
      userId: cmd.userId,
      isActive: cmd.isActive,
      expectedRowVersion: cmd.expectedRowVersion,
      actorUserId,
    }) });
    const res = await userAdminService.getUserById(actorUserId, user.id);
    await publishAdministrativeChange({ resourceType: 'user', resourceId: user.id, changeType: 'updated', actorUserId, data: res ?? undefined });
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
    await withAdministrativeMutationLock({ resourceType: 'user', resourceId: cmd.userId, permission: 'user.assign_roles', work: async () => userAdminService.assignUserRoles({
      userId: cmd.userId,
      roleIds: cmd.roleIds,
      expectedRowVersion: cmd.expectedRowVersion,
      actorUserId,
    }) });
    const res = await userAdminService.getUserById(actorUserId, cmd.userId);
    await publishAdministrativeChange({ resourceType: 'user', resourceId: cmd.userId, changeType: 'updated', actorUserId, data: res ?? undefined });
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
    const user = await withAdministrativeMutationLock({ resourceType: 'user', resourceId: cmd.userId, permission: 'user.update', work: async () => userAdminService.updateUser({
      userId: cmd.userId,
      email: cmd.email,
      isSuperAdmin: cmd.isSuperAdmin,
      expectedRowVersion: cmd.expectedRowVersion,
      actorUserId,
    }) });
    const res = await userAdminService.getUserById(actorUserId, user.id);
    await publishAdministrativeChange({ resourceType: 'user', resourceId: user.id, changeType: 'updated', actorUserId, data: res ?? undefined });
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
    const user = await withAdministrativeMutationLock({ resourceType: 'user', resourceId: cmd.userId, permission: 'user.update', work: async () => userAdminService.resetUserPassword({
      userId: cmd.userId,
      newPassword: cmd.newPassword,
      expectedRowVersion: cmd.expectedRowVersion,
      actorUserId,
    }) });
    const res = await userAdminService.getUserById(actorUserId, user.id);
    await publishAdministrativeChange({ resourceType: 'user', resourceId: user.id, changeType: 'updated', actorUserId, data: res ?? undefined });
    return { success: true, data: res ?? undefined };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

/** Releases only the selected account's credential-attempt limiter. */
export async function releaseUserLoginRateLimitAction(userId: string): Promise<{
  success: boolean;
  error?: ApiErrorResponse;
}> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    await authApplicationService.releaseUserLoginRateLimit(actorUserId, userId);
    return { success: true };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}
