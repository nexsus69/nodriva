import { Entity } from '../../domain/models/Entity.js';

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
  updatedBy: string | null;
}

export interface EntityRepository {
  findById(id: string): Promise<Entity | null>;
  findDeletedById(id: string): Promise<Entity | null>;
  listByNode(parentNodeId: string, limit?: number, offset?: number): Promise<Entity[]>;
  listDeletedByScope(actorUserId: string, limit?: number, offset?: number): Promise<DeletedEntitySummary[]>;
  create(entity: Entity): Promise<void>;
  update(entity: Entity): Promise<void>;
  softDelete(id: string, actorUserId: string, expectedRowVersion: number): Promise<void>;
  restore(id: string, actorUserId: string, expectedRowVersion: number): Promise<void>;
}
