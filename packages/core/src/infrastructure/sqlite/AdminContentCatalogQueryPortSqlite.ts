/** Provides SQLite-backed, ACL-filtered administrative content catalogue pages. */
import type {
  AdminContentCatalogPage,
  AdminContentCatalogPageParams,
  AdminContentCatalogQueryPort,
  AdminEntityCatalogItem,
  AdminNodeCatalogItem,
  RecycleBinOperationItem,
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

  async findNodeSummary(actorUserId: string, nodeId: string): Promise<AdminNodeCatalogItem | null> {
    const acl = AccessControlPortSqlite.getReadAccessControlSql('n', actorUserId, 'node.read');
    return this.database.get<AdminNodeCatalogItem>(`
      SELECT n.id,n.parent_id AS parentId,n.node_type_id AS nodeTypeId,n.name,n.description,
             n.path,n.path_label AS pathLabel,n.row_version AS rowVersion,nt.name AS typeLabel
      FROM nodes n JOIN node_types nt ON nt.id=n.node_type_id
      WHERE n.id=? AND n.deleted_at IS NULL AND ${acl.sql}
    `, [nodeId, ...acl.values]) ?? null;
  }

  async findEntitySummary(actorUserId: string, entityId: string): Promise<AdminEntityCatalogItem | null> {
    const acl = AccessControlPortSqlite.getReadAccessControlSql('n', actorUserId, 'entity.read');
    return this.database.get<AdminEntityCatalogItem>(`
      SELECT e.id,e.parent_node_id AS parentNodeId,e.entity_type_id AS entityTypeId,e.name,e.description,
             e.row_version AS rowVersion,n.name AS nodeName,n.path AS nodePath,et.name AS typeLabel
      FROM entities e JOIN nodes n ON n.id=e.parent_node_id JOIN entity_types et ON et.id=e.entity_type_id
      WHERE e.id=? AND e.deleted_at IS NULL AND n.deleted_at IS NULL AND ${acl.sql}
    `, [entityId, ...acl.values]) ?? null;
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
  async findRecycleBinPage(params: AdminContentCatalogPageParams): Promise<AdminContentCatalogPage<RecycleBinOperationItem>> {
    const nodeAcl = AccessControlPortSqlite.getReadAccessControlSql('n', params.actorUserId, 'node.restore');
    const entityAcl = AccessControlPortSqlite.getReadAccessControlSql('n', params.actorUserId, 'entity.restore');
    const source = `SELECT n.id,'node_subtree' AS kind,n.name,n.path AS detail,n.deleted_at AS deletedAt,n.row_version AS rowVersion,(SELECT count(*) FROM nodes x WHERE x.deleted_at IS NOT NULL AND x.deletion_batch_id=n.deletion_batch_id) AS affectedNodeCount,(SELECT count(*) FROM entities x WHERE x.deleted_at IS NOT NULL AND x.deletion_batch_id=n.deletion_batch_id) AS affectedEntityCount FROM nodes n WHERE n.deleted_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM nodes p WHERE p.id=n.parent_id AND p.deleted_at IS NOT NULL AND p.deletion_batch_id=n.deletion_batch_id) AND ${nodeAcl.sql} UNION ALL SELECT e.id,'entity',e.name,et.name,e.deleted_at,e.row_version,0,1 FROM entities e JOIN nodes n ON n.id=e.parent_node_id JOIN entity_types et ON et.id=e.entity_type_id WHERE e.deleted_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM nodes r WHERE r.deleted_at IS NOT NULL AND r.deletion_batch_id=e.deletion_batch_id) AND ${entityAcl.sql}`;
    const values = [...nodeAcl.values, ...entityAcl.values]; const pageSize = Math.min(100, Math.max(1, params.pageSize)); const requestedPage = Math.max(1, params.page);
    const total = Number(this.database.get<{ total: number }>(`SELECT count(*) AS total FROM (${source}) operations`, values)?.total ?? 0); const pageCount = Math.max(1, Math.ceil(total / pageSize)); const page = Math.min(requestedPage, pageCount);
    return { items: this.database.all<RecycleBinOperationItem>(`SELECT * FROM (${source}) operations ORDER BY deletedAt DESC,id DESC LIMIT ? OFFSET ?`, [...values, pageSize, (page - 1) * pageSize]), total, page, pageCount };
  }
}
