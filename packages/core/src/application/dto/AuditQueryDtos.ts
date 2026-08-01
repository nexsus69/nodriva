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
  resourceKind?: string;
  resourceId?: string;
  nodeId?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResultDto<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
