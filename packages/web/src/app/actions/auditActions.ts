'use server';

import { auditAdminService } from '../../server/db';
import {
  AuditLogFilterDto,
  AuditLogListItemDto,
  AuditLogDetailDto,
  PaginatedResultDto,
  ApiErrorResponse,
} from '@dashboard/core';
import { AuthResolver } from './auth/AuthResolver';
import { mapAuthorizationError } from './errorMapping';

export async function listAuditLogsAction(filters: AuditLogFilterDto): Promise<{
  success: boolean;
  data?: PaginatedResultDto<AuditLogListItemDto>;
  error?: ApiErrorResponse;
}> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    const data = await auditAdminService.getAuditLogs(actorUserId, filters);
    return { success: true, data };
  } catch (err: unknown) {
    const authorizationError = mapAuthorizationError(err);
    if (authorizationError) return { success: false, error: authorizationError };
    const message = err instanceof Error ? err.message : 'Errore durante il recupero degli audit log.';
    return { success: false, error: { message, code: 'INTERNAL_ERROR' } };
  }
}

export async function getAuditLogByIdAction(id: string): Promise<{
  success: boolean;
  data?: AuditLogDetailDto | null;
  error?: ApiErrorResponse;
}> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    const data = await auditAdminService.getAuditLogById(actorUserId, id);
    return { success: true, data };
  } catch (err: unknown) {
    const authorizationError = mapAuthorizationError(err);
    if (authorizationError) return { success: false, error: authorizationError };
    const message = err instanceof Error ? err.message : 'Errore durante il recupero del dettaglio audit log.';
    return { success: false, error: { message, code: 'INTERNAL_ERROR' } };
  }
}
