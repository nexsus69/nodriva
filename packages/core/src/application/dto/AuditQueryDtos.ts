/** Declares portable audit query payloads used by administration read models. */
export interface AuditLogListItemDto {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  actionKey: string;
  resourceKind: string;
  resourceId: string;
  nodeId: string | null;
  createdAt: string;
}

export interface AuditLogDetailDto extends AuditLogListItemDto {
  beforePayload: Record<string, unknown> | null;
  afterPayload: Record<string, unknown> | null;
}

export interface AuditLogFilterDto {
  actorUserId?: string;
  actionKey?: string;
  actionKeyPrefix?: string;
  resourceKind?: string;
  resourceId?: string;
  nodeId?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
}

/** Lists the authorized technical values that can be translated into semantic audit filters. */
export interface AuditFilterCatalogDto {
  actionKeys: string[];
  resourceKinds: string[];
}

export interface PaginatedResultDto<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
