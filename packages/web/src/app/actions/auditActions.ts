'use server';

/** Provides authenticated audit administration reads through typed server actions. */
import { auditAdminService } from '../../server/db';
import {
  AuditLogFilterDto,
  AuditLogListItemDto,
  AuditLogDetailDto,
  AuditFilterCatalogDto,
  PaginatedResultDto,
  ApiErrorResponse,
} from '@dashboard/core';
import { AuthResolver } from './auth/AuthResolver';
import { mapAppErrorToApiErrorResponse } from './errorMapping';

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
    return { success: false, error: mapAppErrorToApiErrorResponse(err) };
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
    return { success: false, error: mapAppErrorToApiErrorResponse(err) };
  }
}

/** Returns only audit filter values the current actor may inspect. */
export async function listAuditFilterCatalogAction(): Promise<{
  success: boolean;
  data?: AuditFilterCatalogDto;
  error?: ApiErrorResponse;
}> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    return { success: true, data: await auditAdminService.getFilterCatalog(actorUserId) };
  } catch (err: unknown) {
    return { success: false, error: mapAppErrorToApiErrorResponse(err) };
  }
}

export async function listTypeSchemaHistoryAction(kind: 'node' | 'entity', typeId: string): Promise<{
  success: boolean;
  data?: PaginatedResultDto<AuditLogListItemDto>;
  error?: ApiErrorResponse;
}> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    const data = await auditAdminService.getAuditLogs(actorUserId, {
      resourceKind: kind === 'node' ? 'node_type' : 'entity_type',
      resourceId: typeId,
      actionKeyPrefix: 'type_admin.',
      page: 1,
      pageSize: 50,
    });
    return { success: true, data };
  } catch (err: unknown) {
    return { success: false, error: mapAppErrorToApiErrorResponse(err) };
  }
}
