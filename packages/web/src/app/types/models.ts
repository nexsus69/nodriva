export interface ClientNode {
  id: string;
  parentId: string | null;
  path: string;
  pathLabel: string;
  depth: number;
  nodeTypeId: string;
  name: string;
  description: string;
  rowVersion: number;
}

export interface ClientEntity {
  id: string;
  entityTypeId: string;
  parentNodeId: string;
  name: string;
  description: string;
  rowVersion: number;
  createdAt?: string;
  updatedAt?: string;
  payload: Record<string, unknown>;
}

export interface NodeTypeMeta {
  id: string;
  typeKey: string;
  name: string;
  description: string;
  currentSchemaVersion: number;
}

export interface EntityTypeMeta {
  id: string;
  typeKey: string;
  name: string;
  description: string;
  storageTable: string;
  currentSchemaVersion: number;
}
