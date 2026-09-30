/** Provides the SQLite subtree entity read model while preserving application-level payload policies. */
import type {
  EntitySubtreePaginatedResult,
  EntitySubtreeQueryParams,
  EntitySubtreeQueryPort,
  SubtreeEntityDto,
} from '../../application/ports/EntitySubtreeQueryPort.js';
import type { AccessControlPort } from '../../application/ports/AccessControlPort.js';
import type { SqliteDatabase } from './SqliteDatabase.js';
import type { FieldEncryptionServiceSqlite } from './FieldEncryptionServiceSqlite.js';
import { AccessControlPortSqlite } from './AccessControlPortSqlite.js';

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
  ) {
    this.database.protectAsyncMethods(this);
  }

  async findSubtreeEntitiesPaginated(params: EntitySubtreeQueryParams): Promise<EntitySubtreePaginatedResult> {
    const base = this.database.get<PathRow>('SELECT path FROM nodes WHERE id=? AND deleted_at IS NULL', [params.baseNodeId]);
    if (!base) return { items: [], hasMore: false };

    const conditions = ['e.deleted_at IS NULL', 'n.deleted_at IS NULL', '(n.path=? OR n.path LIKE ?)'];
    const values: unknown[] = [base.path, `${base.path}.%`];
    if (this.accessControl) {
      const acl = AccessControlPortSqlite.getReadAccessControlSql('n', params.actorUserId, 'entity.read');
      conditions.push(acl.sql);
      values.push(...acl.values);
    }
    if (params.entityTypeId) { conditions.push('e.entity_type_id=?'); values.push(params.entityTypeId); }
    this.addSearchCondition(conditions, values, '(e.name LIKE ? ESCAPE \'\\\' OR e.id LIKE ? ESCAPE \'\\\' OR n.name LIKE ? ESCAPE \'\\\')', params.search, 3);
    this.addSearchCondition(conditions, values, 'e.name LIKE ? ESCAPE \'\\\'', params.filters?.name, 1);
    this.addSearchCondition(conditions, values, 'e.description LIKE ? ESCAPE \'\\\'', params.filters?.description, 1);
    if (params.filters?.lockState === 'locked') conditions.push('l.user_id IS NOT NULL');
    if (params.filters?.lockState === 'unlocked') conditions.push('l.user_id IS NULL');

    const direction = params.direction === 'backward' ? 'DESC' : 'ASC';
    if (params.cursor?.path && params.cursor.id) {
      const operator = params.direction === 'backward' ? '<' : '>';
      conditions.push(`(n.path, e.name, e.id) ${operator} (?, ?, ?)`);
      values.push(params.cursor.path, params.cursor.name ?? '', params.cursor.id);
    }
    values.push(params.limit + 1);
    const rows = this.database.all<EntityRow>(
        `SELECT e.id,e.parent_node_id,e.entity_type_id,e.name,e.description,e.row_version,e.created_at,e.updated_at,e.payload,
                n.name AS nodeName,n.path AS nodePath,n.depth AS nodeDepth,n.row_version AS nodeRowVersion,
                l.user_id AS lockUserId,l.session_id AS lockSessionId,l.expires_at AS lockExpiresAt
         FROM entities e JOIN nodes n ON n.id=e.parent_node_id
         LEFT JOIN locks l ON l.resource_type='entity' AND l.resource_id=e.id AND l.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE ${conditions.join(' AND ')}
         ORDER BY n.path ${direction}, e.name ${direction}, e.id ${direction}
         LIMIT ?`,
        values,
      );
    const hasMore = rows.length > params.limit;
    const pageRows = hasMore ? rows.slice(0, params.limit) : rows;
    if (params.direction === 'backward') pageRows.reverse();
    const items = await Promise.all(pageRows.map((row) => this.mapRow(row)));
    return {
      items,
      hasMore,
      ...(items[0] ? { prevCursor: { path: items[0].nodePath, name: items[0].name, id: items[0].id } } : {}),
      ...(items.at(-1) ? { nextCursor: { path: items.at(-1)!.nodePath, name: items.at(-1)!.name, id: items.at(-1)!.id } } : {}),
    };
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
