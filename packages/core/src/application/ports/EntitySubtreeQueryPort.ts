export interface SubtreeEntityDto {
  id: string;
  parentNodeId: string;
  entityTypeId: string;
  name: string;
  description: string;
  rowVersion: number;
  createdAt: Date;
  updatedAt: Date;
  payload: Record<string, unknown>;
  nodeName: string;
  nodePath: string;
  nodeDepth: number;
  nodeRowVersion: number;
  lockUserId?: string;
  lockSessionId?: string;
  lockExpiresAt?: Date;
}

export interface SubtreeCursor {
  path: string;
  name: string;
  id: string;
}

export interface EntitySubtreeQueryParams {
  baseNodeId: string;
  limit: number;
  direction?: 'forward' | 'backward';
  cursor?: SubtreeCursor;
  search?: string;
  entityTypeId?: string;
  filters?: {
    name?: string;
    description?: string;
    lockState?: 'locked' | 'unlocked';
  };
  actorUserId: string; // INIETTATO DAL BACKEND, MAI TRUSTED DAL CLIENT
}

export interface EntitySubtreePaginatedResult {
  items: SubtreeEntityDto[];
  nextCursor?: SubtreeCursor;
  prevCursor?: SubtreeCursor;
  hasMore: boolean;
}

export interface EntitySubtreeQueryPort {
  findSubtreeEntitiesPaginated(
    params: EntitySubtreeQueryParams
  ): Promise<EntitySubtreePaginatedResult>;
}
