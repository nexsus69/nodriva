/** Defines the authorized, paged catalogue read model used by administrative content lists. */
export type AdminContentCatalogSortKey = 'path' | 'name' | 'type';
export type AdminContentCatalogSortDirection = 'ascending' | 'descending';

export interface AdminContentCatalogPageParams {
  actorUserId: string;
  page: number;
  pageSize: number;
  search?: string;
  sort?: { key: AdminContentCatalogSortKey; direction: AdminContentCatalogSortDirection };
}

export interface AdminContentCatalogPage<T> {
  items: T[];
  total: number;
  page: number;
  pageCount: number;
}

export interface AdminNodeCatalogItem {
  id: string;
  parentId: string | null;
  nodeTypeId: string;
  name: string;
  description: string;
  path: string;
  pathLabel: string;
  rowVersion: number;
  typeLabel: string;
}

export interface AdminEntityCatalogItem {
  id: string;
  parentNodeId: string;
  entityTypeId: string;
  name: string;
  description: string;
  rowVersion: number;
  nodeName: string;
  nodePath: string;
  typeLabel: string;
}

export interface AdminContentCatalogQueryPort {
  findNodesPage(params: AdminContentCatalogPageParams): Promise<AdminContentCatalogPage<AdminNodeCatalogItem>>;
  findEntitiesPage(params: AdminContentCatalogPageParams): Promise<AdminContentCatalogPage<AdminEntityCatalogItem>>;
}
