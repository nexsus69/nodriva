import { DeletedEntitySummary, EntityRepository } from '../../application/ports/EntityRepository.js';
import { Entity } from '../../domain/models/Entity.js';
import { PgExecutor } from './PgExecutor.js';
import { EntityNotFoundError } from '../../domain/errors/EntityErrors.js';
import { RowVersionMismatchError } from '../../domain/errors/DomainErrors.js';
import { FieldEncryptionService } from './FieldEncryptionService.js';
import { AccessControlPortPostgres } from './AccessControlPortPostgres.js';

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
  constructor(private readonly executor: PgExecutor, private readonly fieldEncryption?: FieldEncryptionService) {}

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

    const restoredPayload = this.fieldEncryption ? await this.fieldEncryption.restore('entity', baseRow.id, payload) : payload;
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
      restoredPayload
    );
  }

  async findDeletedById(id: string): Promise<Entity | null> {
    const baseResult = await this.executor.query<BaseEntityRow>(`
      SELECT id, entity_type_id, parent_node_id, name, description, row_version,
             created_at, updated_at, deleted_at, created_by, updated_by
      FROM entities WHERE id = $1 AND deleted_at IS NOT NULL
    `, [id]);
    const baseRow = baseResult.rows[0];
    if (!baseRow) return null;
    const { storageTable, fields } = await this.getStorageMeta(baseRow.entity_type_id);
    const specResult = await this.executor.query<Record<string, unknown>>(`SELECT * FROM ${this.escapeIdentifier(storageTable)} WHERE entity_id = $1`, [id]);
    const payload: Record<string, unknown> = {};
    const specRow = specResult.rows[0];
    if (specRow) for (const field of fields) payload[field.field_key] = specRow[field.column_name];
    const restoredPayload = this.fieldEncryption ? await this.fieldEncryption.restore('entity', id, payload) : payload;
    return new Entity(baseRow.id, baseRow.entity_type_id, baseRow.parent_node_id, baseRow.name, baseRow.description,
      baseRow.row_version, baseRow.created_at, baseRow.updated_at, baseRow.deleted_at, baseRow.created_by,
      baseRow.updated_by, restoredPayload);
  }

  async listDeletedByScope(actorUserId: string, limit = 100, offset = 0): Promise<DeletedEntitySummary[]> {
    const scopeSql = AccessControlPortPostgres.getReadAccessControlSql('$1', 'n', 'entity.restore');
    const result = await this.executor.query<DeletedEntitySummary>(`
      SELECT e.id, e.entity_type_id AS "entityTypeId", et.name AS "entityTypeName", et.is_active AS "entityTypeActive",
             e.parent_node_id AS "parentNodeId", n.name AS "parentNodeName",
             e.name, e.description, e.row_version AS "rowVersion", e.deleted_at AS "deletedAt",
             e.updated_by AS "updatedBy"
      FROM entities e
      JOIN nodes n ON n.id = e.parent_node_id
      JOIN entity_types et ON et.id = e.entity_type_id
      WHERE e.deleted_at IS NOT NULL AND (${scopeSql})
      ORDER BY e.deleted_at DESC
      LIMIT $2 OFFSET $3
    `, [actorUserId, limit, offset]);
    return result.rows;
  }

  async create(entity: Entity): Promise<void> {
    const { storageTable, fieldMapping } = await this.getStorageMeta(entity.entityTypeId);
    const protectedPayload = this.fieldEncryption ? await this.fieldEncryption.protect('entity', entity.entityTypeId, entity.id, entity.payload) : entity.payload;
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
    for (const [key, val] of Object.entries(protectedPayload)) {
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
    const protectedPayload = this.fieldEncryption ? await this.fieldEncryption.protect('entity', entity.entityTypeId, entity.id, entity.payload) : entity.payload;
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

    for (const [key, val] of Object.entries(protectedPayload)) {
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

  async softDelete(id: string, actorUserId: string, expectedRowVersion: number): Promise<void> {
    const query = `
      UPDATE entities
      SET deleted_at = now(), updated_at = now(), updated_by = $1
      WHERE id = $2 AND row_version = $3 AND deleted_at IS NULL
    `;
    const result = await this.executor.query(query, [actorUserId, id, expectedRowVersion]);
    if (result.rowCount === 0) {
      const current = await this.executor.query<{ row_version: number; deleted_at: Date | null }>(
        'SELECT row_version, deleted_at FROM entities WHERE id = $1', [id]
      );
      const row = current.rows[0];
      if (!row || row.deleted_at !== null) throw new EntityNotFoundError(id);
      throw new RowVersionMismatchError(expectedRowVersion, row.row_version);
    }
  }

  async restore(id: string, actorUserId: string, expectedRowVersion: number): Promise<void> {
    const result = await this.executor.query(
      `UPDATE entities SET deleted_at = NULL, row_version = row_version + 1, updated_at = now(), updated_by = $1
       WHERE id = $2 AND row_version = $3 AND deleted_at IS NOT NULL`,
      [actorUserId, id, expectedRowVersion],
    );
    if (result.rowCount === 0) {
      const current = await this.executor.query<{ row_version: number; deleted_at: Date | null }>('SELECT row_version, deleted_at FROM entities WHERE id = $1', [id]);
      const row = current.rows[0];
      if (!row || row.deleted_at === null) throw new EntityNotFoundError(id);
      throw new RowVersionMismatchError(expectedRowVersion, row.row_version);
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

    return await Promise.all(baseRows.map(async (row) => {
      const payload = payloadMap.get(row.id) ?? {};
      const restoredPayload = this.fieldEncryption ? await this.fieldEncryption.restore('entity', row.id, payload) : payload;
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
        restoredPayload
      );
    }));
  }
}
