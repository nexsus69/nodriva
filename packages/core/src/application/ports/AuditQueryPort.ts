import type {
  AuditLogFilterDto,
  AuditLogListItemDto,
  AuditLogDetailDto,
  PaginatedResultDto,
} from '../dto/AuditQueryDtos.js';

export interface AuditQueryPort {
  listAuditLogs(filters: AuditLogFilterDto): Promise<PaginatedResultDto<AuditLogListItemDto>>;
  getAuditLogById(id: string): Promise<AuditLogDetailDto | null>;
}
