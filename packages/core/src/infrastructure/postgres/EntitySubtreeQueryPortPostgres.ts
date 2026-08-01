import {
  EntitySubtreeQueryPort,
  EntitySubtreeQueryParams,
  EntitySubtreePaginatedResult,
  SubtreeEntityDto,
  SubtreeCursor,
} from '../../application/ports/EntitySubtreeQueryPort.js';
import { PgExecutor } from './PgExecutor.js';
import { AccessControlPortPostgres } from './AccessControlPortPostgres.js';

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
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class EntitySubtreeQueryPortPostgres implements EntitySubtreeQueryPort {
  constructor(private readonly executor: PgExecutor) {}

  async findSubtreeEntitiesPaginated(
    params: EntitySubtreeQueryParams
  ): Promise<EntitySubtreePaginatedResult> {
    const { baseNodeId, limit, direction = 'forward', cursor, search, entityTypeId, actorUserId } = params;

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
    const aclSql = AccessControlPortPostgres.getReadAccessControlSql(`$${paramIndex++}`, 'n');
    sqlParams.push(actorUserId);
    conditions.push(aclSql);

    if (entityTypeId && UUID_REGEX.test(entityTypeId)) {
      conditions.push(`e.entity_type_id = $${paramIndex++}`);
      sqlParams.push(entityTypeId);
    }

    // Escape dei caratteri wildcard %, _ e \ per prevenire wildcard malformate
    if (search && search.trim() !== '') {
      const sanitizedSearch = search.trim().replace(/[%_\\]/g, '\\$&');
      conditions.push(`(e.name ILIKE $${paramIndex} OR e.id ILIKE $${paramIndex} OR n.name ILIKE $${paramIndex})`);
      sqlParams.push(`%${sanitizedSearch}%`);
      paramIndex++;
    }

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
        n.row_version AS node_row_version
      FROM entities e
      INNER JOIN nodes n ON e.parent_node_id = n.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY n.path ${orderDir}, e.name ${orderDir}, e.id ${orderDir}
      LIMIT $${paramIndex}
    `;

    const res = await this.executor.query<SubtreeRow>(query, sqlParams);
    const hasMore = res.rows.length > limit;
    const rawRows = hasMore ? res.rows.slice(0, limit) : res.rows;

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
      payload: {},
      nodeName: row.node_name,
      nodePath: row.node_path,
      nodeDepth: row.node_depth,
      nodeRowVersion: row.node_row_version,
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
