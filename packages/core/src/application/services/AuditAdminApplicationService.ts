import { AuditQueryPort } from '../ports/AuditQueryPort.js';
import { AccessControlPort } from '../ports/AccessControlPort.js';
import {
  AuditLogFilterDto,
  AuditLogListItemDto,
  AuditLogDetailDto,
  PaginatedResultDto,
} from '../dto/AuditQueryDtos.js';

export class AuditAdminApplicationService {
  constructor(
    private readonly auditQueryPort: AuditQueryPort,
    private readonly accessControlPort: AccessControlPort
  ) {}

  async getAuditLogs(actorUserId: string, filters: AuditLogFilterDto): Promise<PaginatedResultDto<AuditLogListItemDto>> {
    await this.accessControlPort.assertHasPermission(actorUserId, 'audit.access', null);
    return await this.auditQueryPort.listAuditLogs(filters);
  }

  async getAuditLogById(actorUserId: string, id: string): Promise<AuditLogDetailDto | null> {
    await this.accessControlPort.assertHasPermission(actorUserId, 'audit.access', null);
    return await this.auditQueryPort.getAuditLogById(id);
  }
}
