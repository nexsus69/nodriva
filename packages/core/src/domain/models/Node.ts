import type { NodePathPolicy } from '../policies/NodePathPolicy.js';
import type { NodeType } from './NodeType.js';

export class Node {
  constructor(
    public readonly id: string,
    public readonly parentId: string | null,
    public readonly path: string,
    public readonly pathLabel: string,
    public readonly depth: number,
    public readonly nodeTypeId: string,
    public readonly name: string,
    public readonly description: string,
    public readonly rowVersion: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly deletedAt: Date | null,
    public readonly createdBy: string | null,
    public readonly updatedBy: string | null,
    public readonly payload: Record<string, unknown> = {}
  ) {}

  public static create(
    id: string,
    parent: Node | null,
    nodeType: NodeType,
    name: string,
    description: string,
    actorUserId: string,
    pathPolicy: NodePathPolicy,
    payload: Record<string, unknown> = {}
  ): Node {
    const pathLabel = pathPolicy.generateLabel(name);
    const path = pathPolicy.buildPath(parent ? parent.path : null, pathLabel);
    const depth = parent ? parent.depth + 1 : 0;
    const now = new Date();

    return new Node(
      id,
      parent ? parent.id : null,
      path,
      pathLabel,
      depth,
      nodeType.id,
      name,
      description,
      1, // rowVersion
      now,
      now,
      null, // deletedAt
      actorUserId,
      actorUserId,
      payload
    );
  }

  /** Returns the next immutable node state after an ordinary content update. */
  public update(
    name: string,
    description: string,
    actorUserId: string,
    payload: Record<string, unknown> = this.payload,
  ): Node {
    return new Node(
      this.id,
      this.parentId,
      this.path,
      this.pathLabel,
      this.depth,
      this.nodeTypeId,
      name,
      description,
      this.rowVersion + 1,
      this.createdAt,
      new Date(),
      this.deletedAt,
      this.createdBy,
      actorUserId,
      payload
    );
  }
}
