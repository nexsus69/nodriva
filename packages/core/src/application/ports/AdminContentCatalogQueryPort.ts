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

/** One independently actionable deletion intention, never a batch consequence. */
export interface RecycleBinOperationItem {
  id: string;
  kind: 'node_subtree' | 'entity';
  name: string;
  detail: string;
  deletedAt: string;
  rowVersion: number;
  affectedNodeCount: number;
  affectedEntityCount: number;
}

export interface AdminContentCatalogQueryPort {
  findRecycleBinPage(params: Pick<AdminContentCatalogPageParams, 'actorUserId' | 'page' | 'pageSize'>): Promise<AdminContentCatalogPage<RecycleBinOperationItem>>;
  findNodesPage(params: AdminContentCatalogPageParams): Promise<AdminContentCatalogPage<AdminNodeCatalogItem>>;
  findEntitiesPage(params: AdminContentCatalogPageParams): Promise<AdminContentCatalogPage<AdminEntityCatalogItem>>;
  /** Reads the authorized administrative projection used to reconcile one realtime node notice. */
  findNodeSummary(actorUserId: string, nodeId: string): Promise<AdminNodeCatalogItem | null>;
  /** Reads the authorized administrative projection used to reconcile one realtime entity notice. */
  findEntitySummary(actorUserId: string, entityId: string): Promise<AdminEntityCatalogItem | null>;
}
