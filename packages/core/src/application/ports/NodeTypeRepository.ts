import type { NodeType } from '../../domain/models/NodeType.js';

export interface NodeTypeRepository {
  findByKey(typeKey: string): Promise<NodeType | null>;
  findById(id: string): Promise<NodeType | null>;
  listAll(): Promise<NodeType[]>;
}
