/** Implements NodeTypeRepositorySqlite within its adapter or regression boundary. */
import type { NodeTypeRepository } from '../../application/ports/NodeTypeRepository.js';
import { NodeType } from '../../domain/models/NodeType.js';
import type { SqliteDatabase } from './SqliteDatabase.js';

interface TypeRow { id: string; type_key: string; name: string; description: string; current_schema_version: number; is_active: number; }

export class NodeTypeRepositorySqlite implements NodeTypeRepository {
  constructor(private readonly database: SqliteDatabase) {
    this.database.protectAsyncMethods(this);
  }
  async findByKey(typeKey: string): Promise<NodeType | null> { return this.find('type_key', typeKey); }
  async findById(id: string): Promise<NodeType | null> { return this.find('id', id); }
  async listAll(): Promise<NodeType[]> { return this.database.all<TypeRow>('SELECT id,type_key,name,description,current_schema_version,is_active FROM node_types WHERE deleted_at IS NULL AND is_active=1 ORDER BY name').map((row) => this.map(row)); }
  private find(column: 'id' | 'type_key', value: string): NodeType | null { const row = this.database.get<TypeRow>(`SELECT id,type_key,name,description,current_schema_version,is_active FROM node_types WHERE ${column}=? AND deleted_at IS NULL AND is_active=1`, [value]); return row ? this.map(row) : null; }
  private map(row: TypeRow): NodeType { return new NodeType(row.id, row.type_key, row.name, row.description, row.current_schema_version, row.is_active === 1); }
}
