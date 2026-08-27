/** Defines persistence-neutral queries for authorized audit exploration. */
import type {
  AuditLogFilterDto,
  AuditLogListItemDto,
  AuditLogDetailDto,
  AuditFilterCatalogDto,
  PaginatedResultDto,
} from '../dto/AuditQueryDtos.js';

export interface AuditQueryPort {
  listFilterCatalog(): Promise<AuditFilterCatalogDto>;
  listAuditLogs(filters: AuditLogFilterDto): Promise<PaginatedResultDto<AuditLogListItemDto>>;
  getAuditLogById(id: string): Promise<AuditLogDetailDto | null>;
}
