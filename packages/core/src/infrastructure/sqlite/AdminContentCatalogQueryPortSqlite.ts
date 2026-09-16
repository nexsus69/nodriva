/** Provides SQLite-backed, ACL-filtered administrative content catalogue pages. */
import type {
  AdminContentCatalogPage,
  AdminContentCatalogPageParams,
  AdminContentCatalogQueryPort,
  AdminEntityCatalogItem,
  AdminNodeCatalogItem,
} from '../../application/ports/AdminContentCatalogQueryPort.js';
import { AccessControlPortSqlite } from './AccessControlPortSqlite.js';
import type { SqliteDatabase } from './SqliteDatabase.js';

export class AdminContentCatalogQueryPortSqlite implements AdminContentCatalogQueryPort {
  constructor(private readonly database: SqliteDatabase) {}

  async findNodesPage(params: AdminContentCatalogPageParams): Promise<AdminContentCatalogPage<AdminNodeCatalogItem>> {
    const acl = AccessControlPortSqlite.getReadAccessControlSql('n', params.actorUserId, 'node.read');
    const { conditions, values } = this.conditions(params, ["n.deleted_at IS NULL", acl.sql], ['n.name', 'n.path', 'nt.name'], acl.values);
    return this.page<AdminNodeCatalogItem>(params, `FROM nodes n JOIN node_types nt ON nt.id=n.node_type_id WHERE ${conditions.join(' AND ')}`, values,
      `SELECT n.id,n.parent_id AS parentId,n.node_type_id AS nodeTypeId,n.name,n.description,n.path,n.path_label AS pathLabel,n.row_version AS rowVersion,nt.name AS typeLabel`,
      this.order(params, 'n.path', 'n.name', 'nt.name', 'n.id'));
  }

  async findEntitiesPage(params: AdminContentCatalogPageParams): Promise<AdminContentCatalogPage<AdminEntityCatalogItem>> {
    const acl = AccessControlPortSqlite.getReadAccessControlSql('n', params.actorUserId, 'entity.read');
    const { conditions, values } = this.conditions(params, ['e.deleted_at IS NULL', 'n.deleted_at IS NULL', acl.sql], ['e.name', 'n.path', 'et.name'], acl.values);
    return this.page<AdminEntityCatalogItem>(params, `FROM entities e JOIN nodes n ON n.id=e.parent_node_id JOIN entity_types et ON et.id=e.entity_type_id WHERE ${conditions.join(' AND ')}`, values,
      `SELECT e.id,e.parent_node_id AS parentNodeId,e.entity_type_id AS entityTypeId,e.name,e.description,e.row_version AS rowVersion,n.name AS nodeName,n.path AS nodePath,et.name AS typeLabel`,
      this.order(params, 'n.path', 'e.name', 'et.name', 'e.id'));
  }

  private conditions(params: AdminContentCatalogPageParams, conditions: string[], fields: readonly string[], values: readonly unknown[]) {
    const mutableValues = [...values];
    if (params.search?.trim()) {
      const query = `%${params.search.trim().replace(/[\\%_]/g, '\\$&')}%`;
      conditions.push(`(${fields.map((field) => `${field} LIKE ? ESCAPE '\\'`).join(' OR ')})`);
      mutableValues.push(query, query, query);
    }
    return { conditions, values: mutableValues };
  }

  private order(params: AdminContentCatalogPageParams, path: string, name: string, type: string, id: string): string {
    const primary = params.sort?.key === 'name' ? name : params.sort?.key === 'type' ? type : path;
    const direction = params.sort?.direction === 'descending' ? 'DESC' : 'ASC';
    return `${primary} ${direction}, ${path} ASC, ${name} ASC, ${id} ASC`;
  }

  private async page<T extends object>(params: AdminContentCatalogPageParams, from: string, values: unknown[], select: string, order: string): Promise<AdminContentCatalogPage<T>> {
    const pageSize = Math.min(100, Math.max(1, params.pageSize));
    const requestedPage = Math.max(1, params.page);
    const total = Number(this.database.get<{ total: number }>(`SELECT count(*) AS total ${from}`, values)?.total ?? 0);
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, pageCount);
    const items = this.database.all<T>(`${select} ${from} ORDER BY ${order} LIMIT ? OFFSET ?`, [...values, pageSize, (page - 1) * pageSize]);
    return { items, total, page, pageCount };
  }
}
