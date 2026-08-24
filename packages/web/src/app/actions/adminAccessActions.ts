'use server';

import { accessControlPort } from '../../server/db';
import { AuthResolver } from './auth/AuthResolver';
import { AppError } from '@dashboard/core';

/** Permissions that can expose at least one global Admin Panel module. */
const ADMIN_PERMISSIONS = [
  'node_type.read',
  'node_type.create',
  'node_type.update',
  'node_type.delete',
  'entity_type.read',
  'entity_type.create',
  'entity_type.update',
  'entity_type.delete',
  'node.restore',
  'node.purge',
  'entity.restore',
  'entity.purge',
  'user.read',
  'user.create',
  'user.update',
  'user.delete',
  'user.assign_roles',
  'role.read',
  'role.create',
  'role.update',
  'role.delete',
  'scope.read',
  'scope.assign',
  'scope.delete',
  'audit.access',
  'system.config.read',
  'system.config',
] as const;

export interface AdminAccessResult {
  allowed: boolean;
  permissions: string[];
}

/** Resolves the backend-verified permissions used only to compose the Admin UI. */
export async function checkAdminAccessAction(): Promise<AdminAccessResult> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    const permissions: string[] = [];
    for (const permission of ADMIN_PERMISSIONS) {
      try {
        await accessControlPort.assertHasPermission(actorUserId, permission, null);
        permissions.push(permission);
      } catch (error) {
        if (error instanceof AppError && error.code === 'ACCESS_FORBIDDEN') {
          // A user can own only a subset of administrative capabilities.
          continue;
        }
        throw error;
      }
    }
    return { allowed: permissions.length > 0, permissions };
  } catch (error) {
    if (error instanceof AppError && error.code === 'AUTH_UNAUTHORIZED') {
      return { allowed: false, permissions: [] };
    }
    throw error;
  }
}
