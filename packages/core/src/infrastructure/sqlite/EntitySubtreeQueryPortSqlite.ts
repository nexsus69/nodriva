/** Provides the SQLite subtree entity read model while preserving application-level payload policies. */
import type {
  EntitySubtreePaginatedResult,
  EntitySubtreeQueryParams,
  EntitySubtreeQueryPort,
  SubtreeEntityDto,
} from '../../application/ports/EntitySubtreeQueryPort.js';
import type { AccessControlPort } from '../../application/ports/AccessControlPort.js';
import { ForbiddenError } from '../../domain/errors/ApplicationErrors.js';
import type { SqliteDatabase } from './SqliteDatabase.js';
import type { FieldEncryptionServiceSqlite } from './FieldEncryptionServiceSqlite.js';

interface PathRow { path: string; }
interface EntityRow {
  id: string;
  parent_node_id: string;
  entity_type_id: string;
  name: string;
  description: string;
  row_version: number;
  created_at: string;
  updated_at: string;
  payload: string;
  nodeName: string;
  nodePath: string;
  nodeDepth: number;
  nodeRowVersion: number;
  lockUserId: string | null;
  lockSessionId: string | null;
  lockExpiresAt: string | null;
}

const parsePayload = (value: string): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Entity payload must be a JSON object.');
  return parsed as Record<string, unknown>;
};

export class EntitySubtreeQueryPortSqlite implements EntitySubtreeQueryPort {
  constructor(
    private readonly database: SqliteDatabase,
    private readonly accessControl?: AccessControlPort,
    private readonly fieldEncryption?: FieldEncryptionServiceSqlite,
  ) {}

  async findSubtreeEntitiesPaginated(params: EntitySubtreeQueryParams): Promise<EntitySubtreePaginatedResult> {
    const base = this.database.get<PathRow>('SELECT path FROM nodes WHERE id=? AND deleted_at IS NULL', [params.baseNodeId]);
    if (!base) return { items: [], hasMore: false };

    const conditions = ['e.deleted_at IS NULL', 'n.deleted_at IS NULL', '(n.path=? OR n.path LIKE ?)'];
    const values: unknown[] = [base.path, `${base.path}.%`];
    if (params.entityTypeId) { conditions.push('e.entity_type_id=?'); values.push(params.entityTypeId); }
    this.addSearchCondition(conditions, values, '(e.name LIKE ? ESCAPE \'\\\' OR e.id LIKE ? ESCAPE \'\\\' OR n.name LIKE ? ESCAPE \'\\\')', params.search, 3);
    this.addSearchCondition(conditions, values, 'e.name LIKE ? ESCAPE \'\\\'', params.filters?.name, 1);
    this.addSearchCondition(conditions, values, 'e.description LIKE ? ESCAPE \'\\\'', params.filters?.description, 1);
    if (params.filters?.lockState === 'locked') conditions.push('l.user_id IS NOT NULL');
    if (params.filters?.lockState === 'unlocked') conditions.push('l.user_id IS NULL');

    const direction = params.direction === 'backward' ? 'DESC' : 'ASC';
    const windowSize = Math.max(params.limit + 1, 25);
    let windowCursor = params.cursor;
    const visible: SubtreeEntityDto[] = [];
    while (visible.length <= params.limit) {
      const windowConditions = [...conditions];
      const windowValues = [...values];
      if (windowCursor?.path && windowCursor.id) {
        const operator = params.direction === 'backward' ? '<' : '>';
        windowConditions.push(`(n.path, e.name, e.id) ${operator} (?, ?, ?)`);
        windowValues.push(windowCursor.path, windowCursor.name ?? '', windowCursor.id);
      }
      windowValues.push(windowSize);
      const rows = this.database.all<EntityRow>(
        `SELECT e.id,e.parent_node_id,e.entity_type_id,e.name,e.description,e.row_version,e.created_at,e.updated_at,e.payload,
                n.name AS nodeName,n.path AS nodePath,n.depth AS nodeDepth,n.row_version AS nodeRowVersion,
                l.user_id AS lockUserId,l.session_id AS lockSessionId,l.expires_at AS lockExpiresAt
         FROM entities e JOIN nodes n ON n.id=e.parent_node_id
         LEFT JOIN locks l ON l.resource_type='entity' AND l.resource_id=e.id AND l.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE ${windowConditions.join(' AND ')}
         ORDER BY n.path ${direction}, e.name ${direction}, e.id ${direction}
         LIMIT ?`,
        windowValues,
      );
      if (rows.length === 0) break;

      const readableIds = this.accessControl?.listReadableResourceIds
        ? new Set(await this.accessControl.listReadableResourceIds(params.actorUserId, 'entity', rows.map((row) => row.id)))
        : null;
      for (const row of rows) {
        if (readableIds && !readableIds.has(row.id)) continue;
        if (this.accessControl && !readableIds && !(await this.canRead(params.actorUserId, row.parent_node_id))) continue;
        visible.push(await this.mapRow(row));
      }
      if (visible.length > params.limit || rows.length < windowSize) break;
      const last = rows.at(-1)!;
      windowCursor = { path: last.nodePath, name: last.name, id: last.id };
    }
    const hasMore = visible.length > params.limit;
    const items = visible.slice(0, params.limit);
    return {
      items,
      hasMore,
      ...(items[0] ? { prevCursor: { path: items[0].nodePath, name: items[0].name, id: items[0].id } } : {}),
      ...(items.at(-1) ? { nextCursor: { path: items.at(-1)!.nodePath, name: items.at(-1)!.name, id: items.at(-1)!.id } } : {}),
    };
  }

  private async canRead(actorUserId: string, nodeId: string): Promise<boolean> {
    try {
      await this.accessControl!.assertCanReadNode(actorUserId, nodeId);
      return true;
    } catch (error: unknown) {
      if (error instanceof ForbiddenError) return false;
      throw error;
    }
  }

  private addSearchCondition(conditions: string[], values: unknown[], condition: string, input: string | undefined, repetitions: number): void {
    if (!input?.trim()) return;
    const escaped = `%${input.trim().replace(/[\\%_]/g, '\\$&')}%`;
    conditions.push(condition);
    for (let index = 0; index < repetitions; index += 1) values.push(escaped);
  }

  private async mapRow(row: EntityRow): Promise<SubtreeEntityDto> {
    const payload = parsePayload(row.payload);
    const item: SubtreeEntityDto = {
      id: row.id, parentNodeId: row.parent_node_id, entityTypeId: row.entity_type_id, name: row.name,
      description: row.description, rowVersion: Number(row.row_version), createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at), payload: this.fieldEncryption ? await this.fieldEncryption.restore('entity', row.id, payload) : payload, nodeName: row.nodeName,
      nodePath: row.nodePath, nodeDepth: Number(row.nodeDepth), nodeRowVersion: Number(row.nodeRowVersion),
    };
    if (row.lockUserId) {
      item.lockUserId = row.lockUserId;
      if (row.lockSessionId) item.lockSessionId = row.lockSessionId;
      if (row.lockExpiresAt) item.lockExpiresAt = new Date(row.lockExpiresAt);
    }
    return item;
  }
}
