/** Provides the PostgreSQL subtree entity read model with scoped pagination. */
import type {
  EntitySubtreeQueryPort,
  EntitySubtreeQueryParams,
  EntitySubtreePaginatedResult,
  SubtreeEntityDto} from '../../application/ports/EntitySubtreeQueryPort.js';
import type { PgExecutor } from './PgExecutor.js';
import { AccessControlPortPostgres } from './AccessControlPortPostgres.js';
import type { FieldEncryptionService } from './FieldEncryptionService.js';

interface SubtreeRow {
  entity_id: string;
  parent_node_id: string;
  entity_type_id: string;
  entity_name: string;
  entity_description: string;
  entity_row_version: number;
  entity_created_at: Date;
  entity_updated_at: Date;
  node_name: string;
  node_path: string;
  node_depth: number;
  node_row_version: number;
  lock_user_id: string | null;
  lock_session_id: string | null;
  lock_expires_at: Date | null;
}

interface EntityStorageMetaRow {
  entity_type_id: string;
  storage_table: string;
}

interface EntityFieldMetaRow {
  entity_type_id: string;
  field_key: string;
  column_name: string;
  data_type?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class EntitySubtreeQueryPortPostgres implements EntitySubtreeQueryPort {
  constructor(private readonly executor: PgExecutor, private readonly fieldEncryption?: FieldEncryptionService) {}

  private escapeIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  private async loadPayloads(rows: readonly SubtreeRow[]): Promise<Map<string, Record<string, unknown>>> {
    const entityIdsByType = new Map<string, string[]>();
    for (const row of rows) {
      const ids = entityIdsByType.get(row.entity_type_id) ?? [];
      ids.push(row.entity_id);
      entityIdsByType.set(row.entity_type_id, ids);
    }

    if (entityIdsByType.size === 0) {
      return new Map();
    }

    const typeIds = [...entityIdsByType.keys()];
    const storageResult = await this.executor.query<EntityStorageMetaRow>(
      `SELECT id AS entity_type_id, storage_table
       FROM entity_types
       WHERE id = ANY($1::uuid[])`,
      [typeIds]
    );
    const storageByType = new Map(storageResult.rows.map((row) => [row.entity_type_id, row.storage_table]));

    const fieldsResult = await this.executor.query<EntityFieldMetaRow>(
      `SELECT entity_type_id, field_key, column_name, data_type
       FROM entity_type_fields
       WHERE entity_type_id = ANY($1::uuid[])
       ORDER BY entity_type_id, position`,
      [typeIds]
    );
    const fieldsByType = new Map<string, EntityFieldMetaRow[]>();
    for (const field of fieldsResult.rows) {
      // Relation values are authoritative in resource_relationships and are
      // hydrated by the application service, just as in the SQLite JSON
      // profile. They must not be read from the legacy physical column.
      if (['file', 'image', 'relation'].includes((field.data_type ?? '').toLowerCase())) continue;
      const fields = fieldsByType.get(field.entity_type_id) ?? [];
      fields.push(field);
      fieldsByType.set(field.entity_type_id, fields);
    }

    const payloads = new Map<string, Record<string, unknown>>();
    for (const [typeId, entityIds] of entityIdsByType) {
      const storageTable = storageByType.get(typeId);
      const fields = fieldsByType.get(typeId) ?? [];
      if (!storageTable || fields.length === 0) {
        for (const entityId of entityIds) payloads.set(entityId, {});
        continue;
      }

      const columns = fields.map((field) => this.escapeIdentifier(field.column_name));
      const result = await this.executor.query<Record<string, unknown>>(
        `SELECT entity_id, ${columns.join(', ')}
         FROM ${this.escapeIdentifier(storageTable)}
         WHERE entity_id = ANY($1::uuid[])`,
        [entityIds]
      );

      const fieldsByColumn = new Map(fields.map((field) => [field.column_name, field.field_key]));
      for (const row of result.rows) {
        const payload: Record<string, unknown> = {};
        for (const [columnName, fieldKey] of fieldsByColumn) {
          payload[fieldKey] = row[columnName];
        }
        payloads.set(String(row.entity_id), this.fieldEncryption
          ? await this.fieldEncryption.restore('entity', String(row.entity_id), payload)
          : payload);
      }
      for (const entityId of entityIds) {
        if (!payloads.has(entityId)) payloads.set(entityId, {});
      }
    }

    return payloads;
  }

  async findSubtreeEntitiesPaginated(
    params: EntitySubtreeQueryParams
  ): Promise<EntitySubtreePaginatedResult> {
    const { baseNodeId, limit, direction = 'forward', cursor, search, entityTypeId, filters, actorUserId } = params;

    // 1. Sanificazione e validazione preventiva del baseNodeId (Evita syntax error su UUID invalido)
    if (!baseNodeId || typeof baseNodeId !== 'string' || !UUID_REGEX.test(baseNodeId)) {
      return { items: [], hasMore: false };
    }

    // 2. Recupero percorso del nodo base
    const nodeQuery = `SELECT path FROM nodes WHERE id = $1 AND deleted_at IS NULL`;
    const nodeRes = await this.executor.query<{ path: string }>(nodeQuery, [baseNodeId]);
    const firstNodeRow = nodeRes.rows[0];
    if (!firstNodeRow) {
      return { items: [], hasMore: false };
    }
    const basePath = firstNodeRow.path;

    // 3. Costruzione dinamica della query SQL
    const sqlParams: unknown[] = [basePath];
    let paramIndex = 2;

    const conditions: string[] = [
      `n.path::ltree <@ $1::ltree`,
      `e.deleted_at IS NULL`,
      `n.deleted_at IS NULL`,
    ];

    // Read Access Control SQL Filter
    const aclSql = AccessControlPortPostgres.getReadAccessControlSql(`$${paramIndex++}`, 'n', 'entity.read');
    sqlParams.push(actorUserId);
    conditions.push(aclSql);

    if (entityTypeId && UUID_REGEX.test(entityTypeId)) {
      conditions.push(`e.entity_type_id = $${paramIndex++}`);
      sqlParams.push(entityTypeId);
    }

    // Escape dei caratteri wildcard %, _ e \ per prevenire wildcard malformate
    if (search && search.trim() !== '') {
      const sanitizedSearch = search.trim().replace(/[%_\\]/g, '\\$&');
      // e.id è UUID: il confronto testuale richiede un cast esplicito,
      // altrimenti PostgreSQL rifiuta UUID ILIKE text e l'intera ricerca
      // libera fallisce anche quando nome o nodo corrispondono.
      conditions.push(`(e.name ILIKE $${paramIndex} OR e.id::text ILIKE $${paramIndex} OR n.name ILIKE $${paramIndex})`);
      sqlParams.push(`%${sanitizedSearch}%`);
      paramIndex++;
    }

    const addLikeFilter = (column: string, value: string | undefined) => {
      if (!value?.trim()) return;
      const sanitized = value.trim().replace(/[%_\\]/g, '\\$&');
      conditions.push(`${column} ILIKE $${paramIndex}`);
      sqlParams.push(`%${sanitized}%`);
      paramIndex++;
    };
    addLikeFilter('e.name', filters?.name);
    addLikeFilter('e.description', filters?.description);
    if (filters?.lockState === 'locked') conditions.push(`l.user_id IS NOT NULL`);
    if (filters?.lockState === 'unlocked') conditions.push(`l.user_id IS NULL`);

    // Validazione preventiva del cursore (evita crash se il cursore è parziale o malformato)
    const isCursorValid =
      cursor &&
      typeof cursor.path === 'string' &&
      typeof cursor.id === 'string' &&
      cursor.path.trim() !== '' &&
      cursor.id.trim() !== '';

    if (isCursorValid) {
      const pathParam = `$${paramIndex++}`;
      const nameParam = `$${paramIndex++}`;
      const idParam = `$${paramIndex++}`;
      sqlParams.push(cursor.path, cursor.name || '', cursor.id);

      const op = direction === 'forward' ? '>' : '<';
      conditions.push(`ROW(n.path, e.name, e.id) ${op} ROW(${pathParam}, ${nameParam}, ${idParam})`);
    }

    const orderDir = direction === 'forward' ? 'ASC' : 'DESC';
    const fetchLimit = limit + 1;
    sqlParams.push(fetchLimit);

    const query = `
      SELECT
        e.id AS entity_id,
        e.parent_node_id,
        e.entity_type_id,
        e.name AS entity_name,
        e.description AS entity_description,
        e.row_version AS entity_row_version,
        e.created_at AS entity_created_at,
        e.updated_at AS entity_updated_at,
        n.name AS node_name,
        n.path AS node_path,
        n.depth AS node_depth,
        n.row_version AS node_row_version,
        l.user_id AS lock_user_id,
        l.session_id AS lock_session_id,
        l.expires_at AS lock_expires_at
      FROM entities e
      INNER JOIN nodes n ON e.parent_node_id = n.id
      LEFT JOIN locks l
        ON l.resource_type = 'entity'
       AND l.resource_id = e.id::text
       AND l.expires_at > NOW()
      WHERE ${conditions.join(' AND ')}
      ORDER BY n.path ${orderDir}, e.name ${orderDir}, e.id ${orderDir}
      LIMIT $${paramIndex}
    `;

    const res = await this.executor.query<SubtreeRow>(query, sqlParams);
    const hasMore = res.rows.length > limit;
    const rawRows = hasMore ? res.rows.slice(0, limit) : res.rows;

    const payloads = await this.loadPayloads(rawRows);

    if (direction === 'backward') {
      rawRows.reverse();
    }

    const items: SubtreeEntityDto[] = rawRows.map((row) => ({
      id: row.entity_id,
      parentNodeId: row.parent_node_id,
      entityTypeId: row.entity_type_id,
      name: row.entity_name || '',
      description: row.entity_description || '',
      rowVersion: row.entity_row_version,
      createdAt: row.entity_created_at,
      updatedAt: row.entity_updated_at,
      payload: payloads.get(row.entity_id) ?? {},
      nodeName: row.node_name,
      nodePath: row.node_path,
      nodeDepth: row.node_depth,
      nodeRowVersion: row.node_row_version,
      ...(row.lock_user_id
        ? row.lock_expires_at
          ? {
              lockUserId: row.lock_user_id,
              ...(row.lock_session_id ? { lockSessionId: row.lock_session_id } : {}),
              lockExpiresAt: row.lock_expires_at,
            }
          : {
              lockUserId: row.lock_user_id,
              ...(row.lock_session_id ? { lockSessionId: row.lock_session_id } : {}),
            }
        : {}),
    }));

    const result: EntitySubtreePaginatedResult = {
      items,
      hasMore,
    };

    if (items.length > 0) {
      const first = items[0];
      const last = items[items.length - 1];
      if (first && last) {
        result.prevCursor = { path: first.nodePath, name: first.name, id: first.id };
        result.nextCursor = { path: last.nodePath, name: last.name, id: last.id };
      }
    }

    return result;
  }
}
