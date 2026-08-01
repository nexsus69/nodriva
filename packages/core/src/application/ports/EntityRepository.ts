import { Entity } from '../../domain/models/Entity.js';

export interface EntityRepository {
  findById(id: string): Promise<Entity | null>;
  listByNode(parentNodeId: string, limit?: number, offset?: number): Promise<Entity[]>;
  create(entity: Entity): Promise<void>;
  update(entity: Entity): Promise<void>;
  softDelete(id: string, actorUserId: string): Promise<void>;
}
