import { EntityRepository } from '../../application/ports/EntityRepository.js';
import { Entity } from '../../domain/models/Entity.js';
import { PgExecutor } from './PgExecutor.js';
import { EntityNotFoundError } from '../../domain/errors/EntityErrors.js';
import { RowVersionMismatchError } from '../../domain/errors/DomainErrors.js';

interface BaseEntityRow {
  id: string;
  entity_type_id: string;
  parent_node_id: string;
  name: string;
  description: string;
  row_version: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  created_by: string | null;
  updated_by: string | null;
}

interface TypeMetaRow {
  storage_table: string;
}

interface FieldMetaRow {
  field_key: string;
  column_name: string;
}

export class EntityRepositoryPostgres implements EntityRepository {
  constructor(private readonly executor: PgExecutor) {}

  private escapeIdentifier(id: string): string {
    return `"${id.replace(/"/g, '""')}"`;
  }

  private async getStorageMeta(entityTypeId: string): Promise<{ storageTable: string; fieldMapping: Map<string, string>; fields: FieldMetaRow[] }> {
    const typeResult = await this.executor.query<TypeMetaRow>(
      'SELECT storage_table FROM entity_types WHERE id = $1',
      [entityTypeId]
    );
    const firstRow = typeResult.rows[0];
    if (!firstRow) {
      throw new Error(`EntityType with ID '${entityTypeId}' was not found in metadata.`);
    }
    const storageTable = firstRow.storage_table;

    const fieldsResult = await this.executor.query<FieldMetaRow>(
      'SELECT field_key, column_name FROM entity_type_fields WHERE entity_type_id = $1',
      [entityTypeId]
    );

    const fieldMapping = new Map<string, string>();
    for (const row of fieldsResult.rows) {
      fieldMapping.set(row.field_key, row.column_name);
    }

    return {
      storageTable,
      fieldMapping,
      fields: fieldsResult.rows,
    };
  }

  async findById(id: string): Promise<Entity | null> {
    const baseQuery = `
      SELECT id, entity_type_id, parent_node_id, name, description, row_version,
             created_at, updated_at, deleted_at, created_by, updated_by
      FROM entities
      WHERE id = $1 AND deleted_at IS NULL
    `;
    const baseResult = await this.executor.query<BaseEntityRow>(baseQuery, [id]);
    const baseRow = baseResult.rows[0];
    if (!baseRow) {
      return null;
    }

    const { storageTable, fields } = await this.getStorageMeta(baseRow.entity_type_id);
    
    const escapedTable = this.escapeIdentifier(storageTable);
    const specQuery = `SELECT * FROM ${escapedTable} WHERE entity_id = $1`;
    const specResult = await this.executor.query<Record<string, unknown>>(specQuery, [id]);

    const payload: Record<string, unknown> = {};
    const specRow = specResult.rows[0];
    if (specRow) {
      for (const field of fields) {
        payload[field.field_key] = specRow[field.column_name];
      }
    }

    return new Entity(
      baseRow.id,
      baseRow.entity_type_id,
      baseRow.parent_node_id,
      baseRow.name,
      baseRow.description,
      baseRow.row_version,
      baseRow.created_at,
      baseRow.updated_at,
      baseRow.deleted_at,
      baseRow.created_by,
      baseRow.updated_by,
      payload
    );
  }

  async create(entity: Entity): Promise<void> {
    const { storageTable, fieldMapping } = await this.getStorageMeta(entity.entityTypeId);
    const escapedTable = this.escapeIdentifier(storageTable);

    // 1. Inserimento nella tabella comune entities
    const baseQuery = `
      INSERT INTO entities (
        id, entity_type_id, parent_node_id, name, description, row_version,
        created_at, updated_at, deleted_at, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `;
    await this.executor.query(baseQuery, [
      entity.id,
      entity.entityTypeId,
      entity.parentNodeId,
      entity.name,
      entity.description,
      entity.rowVersion,
      entity.createdAt,
      entity.updatedAt,
      entity.deletedAt,
      entity.createdBy,
      entity.updatedBy,
    ]);

    // 2. Inserimento nella tabella specifica per tipo (es. entity_device)
    const columns = ['entity_id'];
    const placeholders = ['$1'];
    const values: unknown[] = [entity.id];

    let paramIndex = 2;
    for (const [key, val] of Object.entries(entity.payload)) {
      const columnName = fieldMapping.get(key);
      if (columnName) {
        columns.push(this.escapeIdentifier(columnName));
        placeholders.push(`$${paramIndex}`);
        values.push(val);
        paramIndex++;
      }
    }

    const specQuery = `
      INSERT INTO ${escapedTable} (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
    `;
    await this.executor.query(specQuery, values);
  }

  async update(entity: Entity): Promise<void> {
    const { storageTable, fieldMapping } = await this.getStorageMeta(entity.entityTypeId);
    const escapedTable = this.escapeIdentifier(storageTable);

    // 1. Update nella tabella comune con controllo di concorrenza ottimistica
    const baseQuery = `
      UPDATE entities
      SET name = $1, description = $2, row_version = $3, updated_at = $4, updated_by = $5
      WHERE id = $6 AND row_version = $7 AND deleted_at IS NULL
    `;
    
    const previousRowVersion = entity.rowVersion - 1;
    const baseResult = await this.executor.query(baseQuery, [
      entity.name,
      entity.description,
      entity.rowVersion,
      entity.updatedAt,
      entity.updatedBy,
      entity.id,
      previousRowVersion,
    ]);

    if (baseResult.rowCount === 0) {
      const checkResult = await this.executor.query<{ row_version: number; deleted_at: Date | null }>(
        'SELECT row_version, deleted_at FROM entities WHERE id = $1',
        [entity.id]
      );
      const checkRow = checkResult.rows[0];
      if (!checkRow || checkRow.deleted_at !== null) {
        throw new EntityNotFoundError(entity.id);
      }
      throw new RowVersionMismatchError(previousRowVersion, checkRow.row_version);
    }

    // 2. Update nella tabella specifica per tipo
    const sets: string[] = [];
    const values: unknown[] = [entity.id];
    let paramIndex = 2;

    for (const [key, val] of Object.entries(entity.payload)) {
      const columnName = fieldMapping.get(key);
      if (columnName) {
        sets.push(`${this.escapeIdentifier(columnName)} = $${paramIndex}`);
        values.push(val);
        paramIndex++;
      }
    }

    if (sets.length > 0) {
      const specQuery = `
        UPDATE ${escapedTable}
        SET ${sets.join(', ')}
        WHERE entity_id = $1
      `;
      await this.executor.query(specQuery, values);
    }
  }

  async softDelete(id: string, actorUserId: string): Promise<void> {
    const query = `
      UPDATE entities
      SET deleted_at = now(), updated_at = now(), updated_by = $1
      WHERE id = $2 AND deleted_at IS NULL
    `;
    const result = await this.executor.query(query, [actorUserId, id]);
    if (result.rowCount === 0) {
      throw new EntityNotFoundError(id);
    }
  }

  async listByNode(parentNodeId: string, limit?: number, offset?: number): Promise<Entity[]> {
    let baseQuery = `
      SELECT id, entity_type_id, parent_node_id, name, description, row_version,
             created_at, updated_at, deleted_at, created_by, updated_by
      FROM entities
      WHERE parent_node_id = $1 AND deleted_at IS NULL
      ORDER BY created_at ASC
    `;
    const params: unknown[] = [parentNodeId];
    
    if (limit !== undefined) {
      baseQuery += ' LIMIT $2';
      params.push(limit);
    }
    if (offset !== undefined) {
      baseQuery += ` OFFSET $${params.length + 1}`;
      params.push(offset);
    }

    const baseResult = await this.executor.query<BaseEntityRow>(baseQuery, params);
    if (baseResult.rows.length === 0) {
      return [];
    }

    const baseRows = baseResult.rows;
    const typeGroupMap = new Map<string, string[]>();
    
    for (const row of baseRows) {
      if (!typeGroupMap.has(row.entity_type_id)) {
        typeGroupMap.set(row.entity_type_id, []);
      }
      typeGroupMap.get(row.entity_type_id)!.push(row.id);
    }

    const payloadMap = new Map<string, Record<string, unknown>>();

    for (const [entityTypeId, entityIds] of typeGroupMap.entries()) {
      const { storageTable, fields } = await this.getStorageMeta(entityTypeId);
      const escapedTable = this.escapeIdentifier(storageTable);

      const specQuery = `
        SELECT * FROM ${escapedTable}
        WHERE entity_id = ANY($1)
      `;
      const specResult = await this.executor.query<Record<string, unknown>>(specQuery, [entityIds]);

      for (const specRow of specResult.rows) {
        const entityId = specRow.entity_id as string;
        const payload: Record<string, unknown> = {};
        for (const field of fields) {
          payload[field.field_key] = specRow[field.column_name];
        }
        payloadMap.set(entityId, payload);
      }
    }

    return baseRows.map((row) => {
      return new Entity(
        row.id,
        row.entity_type_id,
        row.parent_node_id,
        row.name,
        row.description,
        row.row_version,
        row.created_at,
        row.updated_at,
        row.deleted_at,
        row.created_by,
        row.updated_by,
        payloadMap.get(row.id) ?? {}
      );
    });
  }
}
