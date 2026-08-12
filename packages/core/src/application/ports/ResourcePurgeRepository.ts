export interface PurgeTargetResult {
  parentNodeId: string | null;
  name: string;
  storageKeys: string[];
}

export interface ResourcePurgeRepository {
  getEntityPurgeContext(entityId: string): Promise<{ parentNodeId: string; name: string } | null>;
  getNodePurgeContext(nodeId: string): Promise<{ parentNodeId: string | null; name: string; deletionBatchId: string } | null>;
  purgeEntity(entityId: string): Promise<PurgeTargetResult>;
  purgeNodeSubtree(nodeId: string): Promise<PurgeTargetResult>;
}
