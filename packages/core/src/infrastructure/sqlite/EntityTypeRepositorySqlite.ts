/** Implements EntityTypeRepositorySqlite within its adapter or regression boundary. */
import type { EntityTypeRepository } from '../../application/ports/EntityTypeRepository.js';
import { EntityType } from '../../domain/models/EntityType.js';
import type { SqliteDatabase } from './SqliteDatabase.js';

interface TypeRow { id: string; type_key: string; name: string; description: string; storage_table: string; current_schema_version: number; is_active: number; }

export class EntityTypeRepositorySqlite implements EntityTypeRepository {
  constructor(private readonly database: SqliteDatabase) {
    this.database.protectAsyncMethods(this);
  }
  async findByKey(typeKey: string): Promise<EntityType | null> { return this.find('type_key', typeKey); }
  async findById(id: string): Promise<EntityType | null> { return this.find('id', id); }
  async listAll(): Promise<EntityType[]> { return this.database.all<TypeRow>('SELECT id,type_key,name,description,storage_table,current_schema_version,is_active FROM entity_types WHERE deleted_at IS NULL AND is_active=1 ORDER BY name').map((row) => this.map(row)); }
  private find(column: 'id' | 'type_key', value: string): EntityType | null { const row = this.database.get<TypeRow>(`SELECT id,type_key,name,description,storage_table,current_schema_version,is_active FROM entity_types WHERE ${column}=? AND deleted_at IS NULL AND is_active=1`, [value]); return row ? this.map(row) : null; }
  private map(row: TypeRow): EntityType { return new EntityType(row.id, row.type_key, row.name, row.description, row.storage_table, row.current_schema_version, row.is_active === 1); }
}
