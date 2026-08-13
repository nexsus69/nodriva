import type { EntityType } from '../../domain/models/EntityType.js';

export interface EntityTypeRepository {
  findByKey(typeKey: string): Promise<EntityType | null>;
  findById(id: string): Promise<EntityType | null>;
  listAll(): Promise<EntityType[]>;
}
