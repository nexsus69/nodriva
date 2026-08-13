import { EntityTypeRepository } from '../../application/ports/EntityTypeRepository.js';
import { EntityType } from '../../domain/models/EntityType.js';
import { PgExecutor } from './PgExecutor.js';

interface EntityTypeRow {
  id: string;
  type_key: string;
  name: string;
  description: string;
  storage_table: string;
  current_schema_version: number;
  is_active: boolean;
}

export class EntityTypeRepositoryPostgres implements EntityTypeRepository {
  constructor(private readonly executor: PgExecutor) {}

  async findByKey(typeKey: string): Promise<EntityType | null> {
    const query = `
      SELECT id, type_key, name, description, storage_table, current_schema_version, is_active
      FROM entity_types
      WHERE type_key = $1 AND deleted_at IS NULL AND is_active = TRUE
    `;
    const result = await this.executor.query<EntityTypeRow>(query, [typeKey]);
    const firstRow = result.rows[0];
    if (!firstRow) {
      return null;
    }
    return this.mapToDomain(firstRow);
  }

  async findById(id: string): Promise<EntityType | null> {
    const query = `
      SELECT id, type_key, name, description, storage_table, current_schema_version, is_active
      FROM entity_types
      WHERE id = $1 AND deleted_at IS NULL AND is_active = TRUE
    `;
    const result = await this.executor.query<EntityTypeRow>(query, [id]);
    const firstRow = result.rows[0];
    if (!firstRow) {
      return null;
    }
    return this.mapToDomain(firstRow);
  }

  async listAll(): Promise<EntityType[]> {
    const query = `
      SELECT id, type_key, name, description, storage_table, current_schema_version, is_active
      FROM entity_types
      WHERE deleted_at IS NULL AND is_active = TRUE
      ORDER BY name ASC
    `;
    const result = await this.executor.query<EntityTypeRow>(query);
    return result.rows.map((row) => this.mapToDomain(row));
  }

  private mapToDomain(row: EntityTypeRow): EntityType {
    return new EntityType(
      row.id,
      row.type_key,
      row.name,
      row.description,
      row.storage_table,
      row.current_schema_version,
      row.is_active
    );
  }
}
