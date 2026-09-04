import type { Entity } from '../../domain/models/Entity.js';

export interface DeletedEntitySummary {
  id: string;
  entityTypeId: string;
  entityTypeName: string;
  entityTypeActive: boolean;
  parentNodeId: string;
  parentNodeName: string;
  name: string;
  description: string;
  rowVersion: number;
  deletedAt: Date;
  /** Non-null only when this entity was deleted as a consequence of a node subtree deletion. */
  deletionBatchId: string | null;
  /** True when a deleted node subtree owns this entity's deletion batch. */
  isSubtreeDeletionDescendant: boolean;
  updatedBy: string | null;
}

export interface EntityRepository {
  listActiveReferenceLabels?(ids: readonly string[]): Promise<{ id: string; type: string; name: string }[]>;
  findById(id: string): Promise<Entity | null>;
  findDeletedById(id: string): Promise<Entity | null>;
  listByNode(parentNodeId: string, limit?: number, offset?: number): Promise<Entity[]>;
  /** Batch active lookup; avoids per-node loops in subtree lifecycle work. */
  listActiveIdsByNodeIds(parentNodeIds: readonly string[]): Promise<string[]>;
  listActiveIds(ids: readonly string[]): Promise<string[]>;
  listDeletedIdsByBatch(deletionBatchId: string): Promise<string[]>;
  listDeletedByScope(actorUserId: string, limit?: number, offset?: number): Promise<DeletedEntitySummary[]>;
  create(entity: Entity): Promise<void>;
  update(entity: Entity): Promise<void>;
  softDelete(id: string, actorUserId: string, expectedRowVersion: number, deletionBatchId: string): Promise<void>;
  restore(id: string, actorUserId: string, expectedRowVersion: number): Promise<void>;
  getDeletionBatchId(entityId: string): Promise<string | null>;
}
