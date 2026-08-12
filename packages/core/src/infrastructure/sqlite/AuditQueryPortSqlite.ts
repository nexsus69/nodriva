import type { AuditQueryPort } from '../../application/ports/AuditQueryPort.js';
import type {
  AuditLogDetailDto,
  AuditLogFilterDto,
  AuditLogListItemDto,
  PaginatedResultDto,
} from '../../application/dto/AuditQueryDtos.js';
import { SqliteDatabase } from './SqliteDatabase.js';

type AuditRow = {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  actionKey: string;
  resourceKind: string;
  resourceId: string;
  nodeId: string | null;
  beforePayload: string | null;
  afterPayload: string | null;
  createdAt: string;
  total?: number;
};

const parsePayload = (value: string | null): Record<string, unknown> | null => {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
};

export class AuditQueryPortSqlite implements AuditQueryPort {
  constructor(private readonly database: SqliteDatabase) {}

  async listAuditLogs(filters: AuditLogFilterDto): Promise<PaginatedResultDto<AuditLogListItemDto>> {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, filters.pageSize ?? 20));
    const conditions: string[] = [];
    const parameters: unknown[] = [];
    const add = (condition: string, value: unknown) => {
      conditions.push(condition);
      parameters.push(value);
    };

    if (filters.actorUserId) add('a.actor_user_id = ?', filters.actorUserId);
    if (filters.actionKey) add('a.action_key = ?', filters.actionKey);
    if (filters.actionKeyPrefix) add('a.action_key LIKE ? ESCAPE \'\\\'', `${filters.actionKeyPrefix.replace(/[\\%_]/g, '\\$&')}%`);
    if (filters.resourceKind) add('a.resource_kind = ?', filters.resourceKind);
    if (filters.resourceId) add('a.resource_id = ?', filters.resourceId);
    if (filters.nodeId) add('a.node_id = ?', filters.nodeId);
    if (filters.fromDate) add('a.occurred_at >= ?', filters.fromDate);
    if (filters.toDate) add('a.occurred_at <= ?', filters.toDate);

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = this.database.all<AuditRow>(
      `SELECT a.id, a.actor_user_id AS actorUserId, u.email AS actorEmail,
              a.action_key AS actionKey, a.resource_kind AS resourceKind,
              a.resource_id AS resourceId, a.node_id AS nodeId,
              a.occurred_at AS createdAt, COUNT(*) OVER() AS total
         FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id
         ${where} ORDER BY a.occurred_at DESC LIMIT ? OFFSET ?`,
      [...parameters, pageSize, (page - 1) * pageSize],
    );
    const total = Number(rows[0]?.total ?? 0);
    return {
      items: rows.map((row) => this.toListItem(row)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getAuditLogById(id: string): Promise<AuditLogDetailDto | null> {
    const row = this.database.get<AuditRow>(
      `SELECT a.id, a.actor_user_id AS actorUserId, u.email AS actorEmail,
              a.action_key AS actionKey, a.resource_kind AS resourceKind,
              a.resource_id AS resourceId, a.node_id AS nodeId,
              a.before_payload AS beforePayload, a.after_payload AS afterPayload,
              a.occurred_at AS createdAt
         FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id
        WHERE a.id = ?`, [id],
    );
    if (!row) return null;
    return {
      ...this.toListItem(row),
      beforePayload: parsePayload(row.beforePayload),
      afterPayload: parsePayload(row.afterPayload),
    };
  }

  private toListItem(row: AuditRow): AuditLogListItemDto {
    return {
      id: row.id,
      actorUserId: row.actorUserId,
      actorEmail: row.actorEmail,
      actionKey: row.actionKey,
      resourceKind: row.resourceKind,
      resourceId: row.resourceId,
      nodeId: row.nodeId,
      createdAt: new Date(row.createdAt).toISOString(),
    };
  }
}
