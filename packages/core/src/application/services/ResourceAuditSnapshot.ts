import type { Entity } from '../../domain/models/Entity.js';
import type { Node } from '../../domain/models/Node.js';

/** Serializes the complete entity state used by durable audit records. */
export function entityAuditSnapshot(entity: Entity): Record<string, unknown> {
  return {
    id: entity.id,
    entityTypeId: entity.entityTypeId,
    parentNodeId: entity.parentNodeId,
    name: entity.name,
    description: entity.description,
    rowVersion: entity.rowVersion,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
    deletedAt: entity.deletedAt?.toISOString() ?? null,
    createdBy: entity.createdBy,
    updatedBy: entity.updatedBy,
    payload: entity.payload,
  };
}

/** Serializes the complete node state used by durable audit records. */
export function nodeAuditSnapshot(node: Node): Record<string, unknown> {
  return {
    id: node.id,
    parentId: node.parentId,
    path: node.path,
    pathLabel: node.pathLabel,
    depth: node.depth,
    nodeTypeId: node.nodeTypeId,
    name: node.name,
    description: node.description,
    rowVersion: node.rowVersion,
    createdAt: node.createdAt.toISOString(),
    updatedAt: node.updatedAt.toISOString(),
    deletedAt: node.deletedAt?.toISOString() ?? null,
    createdBy: node.createdBy,
    updatedBy: node.updatedBy,
    payload: node.payload,
  };
}
