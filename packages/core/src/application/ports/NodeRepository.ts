import { Node } from '../../domain/models/Node.js';

export interface NodeRepository {
  findById(id: string): Promise<Node | null>;
  listChildren(parentId: string | null, limit?: number, offset?: number): Promise<Node[]>;
  create(node: Node): Promise<void>;
  update(node: Node): Promise<void>;
  moveSubtree(nodeId: string, newParentId: string | null, actorUserId: string): Promise<void>;
  existsByParentAndPathLabel(parentId: string | null, pathLabel: string): Promise<boolean>;
  /** Returns the active node ids containing the node itself and all its ancestors. */
  listAncestorIds(nodeId: string): Promise<string[]>;
  /** Returns true if nodeId is a descendant of potentialAncestorId (strict: not self). */
  isDescendantOf(nodeId: string, potentialAncestorId: string): Promise<boolean>;
}
