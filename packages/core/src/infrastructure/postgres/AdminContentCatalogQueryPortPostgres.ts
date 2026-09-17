/** Provides PostgreSQL-backed, ACL-filtered administrative content catalogue pages. */
import type {
  AdminContentCatalogPage,
  AdminContentCatalogPageParams,
  AdminContentCatalogQueryPort,
  AdminEntityCatalogItem,
  AdminNodeCatalogItem,
} from '../../application/ports/AdminContentCatalogQueryPort.js';
import { AccessControlPortPostgres } from './AccessControlPortPostgres.js';
import type { PgExecutor } from './PgExecutor.js';

const ordering = (params: AdminContentCatalogPageParams, path: string, name: string, type: string, id: string) => {
  const key = params.sort?.key ?? 'path';
  const primary = key === 'name' ? name : key === 'type' ? type : path;
  const direction = params.sort?.direction === 'descending' ? 'DESC' : 'ASC';
  return `${primary} ${direction}, ${path} ASC, ${name} ASC, ${id} ASC`;
};

export class AdminContentCatalogQueryPortPostgres implements AdminContentCatalogQueryPort {
  constructor(private readonly executor: PgExecutor) {}

  async findNodesPage(params: AdminContentCatalogPageParams): Promise<AdminContentCatalogPage<AdminNodeCatalogItem>> {
    const { where, values } = this.where(params, 'n', 'node.read', 'n.name', 'n.path::text', 'nt.name');
    return this.page<AdminNodeCatalogItem>(params, `
      SELECT n.id, n.parent_id AS "parentId", n.node_type_id AS "nodeTypeId", n.name, n.description,
             n.path::text AS path, n.path_label AS "pathLabel", n.row_version AS "rowVersion", nt.name AS "typeLabel"
      FROM nodes n JOIN node_types nt ON nt.id=n.node_type_id
      WHERE ${where}
    `, `
      SELECT n.name, n.path::text AS path_text, nt.name AS type_label
      FROM nodes n JOIN node_types nt ON nt.id=n.node_type_id
      WHERE ${where}
    `, values, ordering(params, 'n.path', 'n.name', 'nt.name', 'n.id'));
  }

  async findEntitiesPage(params: AdminContentCatalogPageParams): Promise<AdminContentCatalogPage<AdminEntityCatalogItem>> {
    const { where, values } = this.where(params, 'n', 'entity.read', 'e.name', 'n.path::text', 'et.name', 'e.deleted_at IS NULL');
    return this.page<AdminEntityCatalogItem>(params, `
      SELECT e.id, e.parent_node_id AS "parentNodeId", e.entity_type_id AS "entityTypeId", e.name, e.description,
             e.row_version AS "rowVersion", n.name AS "nodeName", n.path::text AS "nodePath", et.name AS "typeLabel"
      FROM entities e JOIN nodes n ON n.id=e.parent_node_id JOIN entity_types et ON et.id=e.entity_type_id
      WHERE ${where}
    `, `
      SELECT e.name, n.path::text AS path_text, et.name AS type_label
      FROM entities e JOIN nodes n ON n.id=e.parent_node_id JOIN entity_types et ON et.id=e.entity_type_id
      WHERE ${where}
    `, values, ordering(params, 'n.path', 'e.name', 'et.name', 'e.id'));
  }

  async findEntitySummary(actorUserId: string, entityId: string): Promise<AdminEntityCatalogItem | null> {
    const result = await this.executor.query<AdminEntityCatalogItem>(`
      SELECT e.id, e.parent_node_id AS "parentNodeId", e.entity_type_id AS "entityTypeId", e.name, e.description,
             e.row_version AS "rowVersion", n.name AS "nodeName", n.path::text AS "nodePath", et.name AS "typeLabel"
      FROM entities e JOIN nodes n ON n.id=e.parent_node_id JOIN entity_types et ON et.id=e.entity_type_id
      WHERE e.id=$2 AND e.deleted_at IS NULL AND n.deleted_at IS NULL
        AND ${AccessControlPortPostgres.getReadAccessControlSql('$1', 'n', 'entity.read')}
    `, [actorUserId, entityId]);
    return result.rows[0] ?? null;
  }

  private where(params: AdminContentCatalogPageParams, nodeAlias: string, permission: string, name: string, path: string, type: string, extra = '') {
    const values: unknown[] = [params.actorUserId];
    const conditions = [`${nodeAlias}.deleted_at IS NULL`, AccessControlPortPostgres.getReadAccessControlSql('$1', nodeAlias, permission)];
    if (extra) conditions.push(extra);
    if (params.search?.trim()) {
      values.push(`%${params.search.trim().replace(/[%_\\]/g, '\\$&')}%`);
      // The parameter is escaped by the query boundary, therefore the SQL must
      // declare the same escape character instead of treating a user supplied
      // percent or underscore as a wildcard.
      conditions.push(`(${name} ILIKE $2 ESCAPE '\\' OR ${path} ILIKE $2 ESCAPE '\\' OR ${type} ILIKE $2 ESCAPE '\\')`);
    }
    return { where: conditions.join(' AND '), values };
  }

  private async page<T extends object>(params: AdminContentCatalogPageParams, selectSql: string, countSql: string, values: unknown[], order: string): Promise<AdminContentCatalogPage<T>> {
    const countQuery = `SELECT count(*)::int AS total FROM (${countSql}) catalogue`;
    const listQuery = `${selectSql} ORDER BY ${order} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    const requestedPage = Math.max(1, params.page);
    const pageSize = Math.min(100, Math.max(1, params.pageSize));
    // Clamp before calculating OFFSET. Returning the last page number with an
    // empty requested-page result would diverge from SQLite and from the page
    // contract observable by the browser.
    const count = await this.executor.query<{ total: number }>(countQuery, values);
    const total = Number(count.rows[0]?.total ?? 0);
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, pageCount);
    const rows = await this.executor.query<Record<string, unknown>>(
      listQuery,
      [...values, pageSize, (page - 1) * pageSize],
    );
    return { items: rows.rows as T[], total, page, pageCount };
  }
}
