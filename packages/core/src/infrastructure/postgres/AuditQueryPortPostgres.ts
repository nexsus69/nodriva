/** Reads generic audit references from PostgreSQL without restoring schema-specific casts. */
import type { AuditQueryPort } from '../../application/ports/AuditQueryPort.js';
import type {
  AuditLogFilterDto,
  AuditLogListItemDto,
  AuditLogDetailDto,
  AuditFilterCatalogDto,
  PaginatedResultDto,
} from '../../application/dto/AuditQueryDtos.js';
import type { PgExecutor } from './PgExecutor.js';

interface AuditLogListRow {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  actionKey: string;
  resourceKind: string;
  resourceId: string;
  nodeId: string | null;
  createdAt: Date;
  fullCount: number;
}

interface AuditLogDetailRow extends Omit<AuditLogListRow, 'fullCount'> {
  beforePayload: Record<string, unknown> | null;
  afterPayload: Record<string, unknown> | null;
}

interface AuditFilterValueRow { value: string; }

export class AuditQueryPortPostgres implements AuditQueryPort {
  constructor(private readonly executor: PgExecutor) {}

  async listFilterCatalog(): Promise<AuditFilterCatalogDto> {
    const [actions, resourceKinds] = await Promise.all([
      this.executor.query<AuditFilterValueRow>('SELECT DISTINCT action_key AS value FROM audit_logs ORDER BY action_key ASC LIMIT 250'),
      this.executor.query<AuditFilterValueRow>('SELECT DISTINCT resource_kind AS value FROM audit_logs ORDER BY resource_kind ASC LIMIT 250'),
    ]);
    return { actionKeys: actions.rows.map((row) => row.value), resourceKinds: resourceKinds.rows.map((row) => row.value) };
  }

  async listAuditLogs(filters: AuditLogFilterDto): Promise<PaginatedResultDto<AuditLogListItemDto>> {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, filters.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.actorUserId) {
      params.push(filters.actorUserId);
      conditions.push(`a.actor_user_id = $${params.length}`);
    }

    if (filters.actionKey) {
      params.push(filters.actionKey);
      conditions.push(`a.action_key = $${params.length}`);
    }

    if (filters.actionKeyPrefix) {
      params.push(`${filters.actionKeyPrefix}%`);
      conditions.push(`a.action_key LIKE $${params.length}`);
    }

    if (filters.resourceKind) {
      params.push(filters.resourceKind);
      conditions.push(`a.resource_kind = $${params.length}`);
    }

    if (filters.resourceId) {
      params.push(filters.resourceId);
      conditions.push(`a.resource_id = $${params.length}`);
    }

    if (filters.nodeId) {
      params.push(filters.nodeId);
      conditions.push(`a.node_id = $${params.length}`);
    }

    if (filters.fromDate) {
      params.push(filters.fromDate);
      conditions.push(`a.created_at >= $${params.length}::timestamptz`);
    }

    if (filters.toDate) {
      params.push(filters.toDate);
      conditions.push(`a.created_at <= $${params.length}::timestamptz`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(pageSize, offset);
    const limitOffsetClause = `LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const query = `
      SELECT 
        a.id,
        a.actor_user_id AS "actorUserId",
        u.email AS "actorEmail",
        a.action_key AS "actionKey",
        a.resource_kind AS "resourceKind",
        a.resource_id AS "resourceId",
        a.node_id AS "nodeId",
        a.created_at AS "createdAt",
        COUNT(*) OVER() AS "fullCount"
      FROM audit_logs a
      LEFT JOIN users u ON a.actor_user_id = u.id
      ${whereClause}
      ORDER BY a.created_at DESC
      ${limitOffsetClause}
    `;

    const res = await this.executor.query<AuditLogListRow>(query, params);

    const firstRow = res.rows[0];
    const total = firstRow ? Number(firstRow.fullCount) : 0;
    const totalPages = Math.ceil(total / pageSize);

    const items: AuditLogListItemDto[] = res.rows.map((r) => ({
      id: r.id,
      actorUserId: r.actorUserId ?? null,
      actorEmail: r.actorEmail ?? null,
      actionKey: r.actionKey,
      resourceKind: r.resourceKind,
      resourceId: r.resourceId,
      nodeId: r.nodeId ?? null,
      createdAt: new Date(r.createdAt).toISOString(),
    }));

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  async getAuditLogById(id: string): Promise<AuditLogDetailDto | null> {
    const query = `
      SELECT 
        a.id,
        a.actor_user_id AS "actorUserId",
        u.email AS "actorEmail",
        a.action_key AS "actionKey",
        a.resource_kind AS "resourceKind",
        a.resource_id AS "resourceId",
        a.node_id AS "nodeId",
        a.before_payload AS "beforePayload",
        a.after_payload AS "afterPayload",
        a.created_at AS "createdAt"
      FROM audit_logs a
      LEFT JOIN users u ON a.actor_user_id = u.id
      WHERE a.id = $1
    `;

    const res = await this.executor.query<AuditLogDetailRow>(query, [id]);
    if (res.rowCount === 0 || !res.rows[0]) return null;

    const r = res.rows[0];

    return {
      id: r.id,
      actorUserId: r.actorUserId ?? null,
      actorEmail: r.actorEmail ?? null,
      actionKey: r.actionKey,
      resourceKind: r.resourceKind,
      resourceId: r.resourceId,
      nodeId: r.nodeId ?? null,
      beforePayload: r.beforePayload ?? null,
      afterPayload: r.afterPayload ?? null,
      createdAt: new Date(r.createdAt).toISOString(),
    };
  }
}
