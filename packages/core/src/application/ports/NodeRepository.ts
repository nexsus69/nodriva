import type { Node } from '../../domain/models/Node.js';

export interface DeletedNodeSummary {
  id: string;
  nodeTypeId: string;
  nodeTypeName: string;
  parentId: string | null;
  parentName: string | null;
  name: string;
  path: string;
  rowVersion: number;
  deletedAt: Date;
  deletionBatchId: string | null;
}

export interface NodeRepository {
  findById(id: string): Promise<Node | null>;
  findDeletedById(id: string): Promise<Node | null>;
  listDeletedByScope(actorUserId: string, limit?: number, offset?: number): Promise<DeletedNodeSummary[]>;
  listChildren(parentId: string | null, limit?: number, offset?: number): Promise<Node[]>;
  /** Optional optimized projection used by PostgreSQL adapters. */
  listReadableChildren?(parentId: string | null, actorUserId: string): Promise<Node[]>;
  listReadableVirtualRoots?(actorUserId: string): Promise<Node[]>;
  create(node: Node): Promise<void>;
  update(node: Node): Promise<void>;
  moveSubtree(nodeId: string, newParentId: string | null, actorUserId: string): Promise<void>;
  listSubtree(nodeId: string): Promise<Node[]>;
  existsByParentAndPathLabel(parentId: string | null, pathLabel: string): Promise<boolean>;
  /** Returns the active node ids containing the node itself and all its ancestors. */
  listAncestorIds(nodeId: string): Promise<string[]>;
  /** Resolves ancestors for multiple nodes with one repository operation. */
  listAncestorIdsForNodes?(nodeIds: string[]): Promise<Map<string, string[]>>;
  /** Returns true if nodeId is a descendant of potentialAncestorId (strict: not self). */
  isDescendantOf(nodeId: string, potentialAncestorId: string): Promise<boolean>;
  softDeleteSubtree(nodeId: string, actorUserId: string, expectedRowVersion: number, deletionBatchId: string): Promise<string[]>;
  assertSubtreeUnlocked(nodeId: string, actorUserId: string): Promise<void>;
  getDeletionBatchId(nodeId: string): Promise<string | null>;
  restoreSubtree(nodeId: string, actorUserId: string, expectedRowVersion: number, deletionBatchId: string): Promise<string[]>;
}
