import { Entity } from '../../domain/models/Entity.js';
import { EntityNotFoundError } from '../../domain/errors/EntityErrors.js';
import { RowVersionMismatchError } from '../../domain/errors/DomainErrors.js';
import type { DeletedEntitySummary, EntityRepository } from '../../application/ports/EntityRepository.js';
import type { SqliteDatabase } from './SqliteDatabase.js';
import type { AccessControlPortSqlite } from './AccessControlPortSqlite.js';

interface EntityRow { id: string; entity_type_id: string; parent_node_id: string; name: string; description: string; row_version: number; created_at: string; updated_at: string; deleted_at: string | null; created_by: string | null; updated_by: string | null; payload: string; deletion_batch_id: string | null; }

/** SQLite entity repository. Dynamic fields are stored as JSON, preserving the domain contract. */
export class EntityRepositorySqlite implements EntityRepository {
  constructor(private readonly database: SqliteDatabase, private readonly accessControl?: AccessControlPortSqlite) {}

  async listActiveReferenceLabels(ids: readonly string[]): Promise<{ id: string; type: string; name: string }[]> {
    if (ids.length === 0) return [];
    return this.database.all<{ id: string; type: string; name: string }>(`SELECT e.id,t.name AS type,e.name FROM entities e JOIN entity_types t ON t.id=e.entity_type_id WHERE e.id IN (${ids.map(() => '?').join(',')}) AND e.deleted_at IS NULL`, [...new Set(ids)]);
  }

  async findById(id: string): Promise<Entity | null> { return this.find(id, false); }
  async findDeletedById(id: string): Promise<Entity | null> { return this.find(id, true); }

  async listByNode(parentNodeId: string, limit?: number, offset?: number): Promise<Entity[]> {
    const params: unknown[] = [parentNodeId]; let sql = 'SELECT * FROM entities WHERE parent_node_id=? AND deleted_at IS NULL ORDER BY name, id';
    if (limit !== undefined) { sql += ' LIMIT ?'; params.push(limit); }
    if (offset !== undefined) { sql += ' OFFSET ?'; params.push(offset); }
    return this.database.all<EntityRow>(sql, params).map((row) => this.map(row));
  }
  async listActiveIds(ids: readonly string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    return this.database.all<{ id: string }>(`SELECT id FROM entities WHERE deleted_at IS NULL AND id IN (${ids.map(() => '?').join(',')})`, [...new Set(ids)]).map((row) => row.id);
  }
  async listActiveIdsByNodeIds(parentNodeIds: readonly string[]): Promise<string[]> {
    if (parentNodeIds.length === 0) return [];
    return this.database.all<{ id: string }>(`SELECT id FROM entities WHERE deleted_at IS NULL AND parent_node_id IN (${parentNodeIds.map(() => '?').join(',')})`, [...new Set(parentNodeIds)]).map((row) => row.id);
  }
  async listDeletedIdsByBatch(deletionBatchId: string): Promise<string[]> {
    return this.database.all<{ id: string }>('SELECT id FROM entities WHERE deleted_at IS NOT NULL AND deletion_batch_id=?', [deletionBatchId]).map((row) => row.id);
  }

  async create(entity: Entity): Promise<void> {
    this.database.run('INSERT INTO entities (id,entity_type_id,parent_node_id,name,description,row_version,created_at,updated_at,deleted_at,created_by,updated_by,payload) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', [entity.id, entity.entityTypeId, entity.parentNodeId, entity.name, entity.description, entity.rowVersion, entity.createdAt.toISOString(), entity.updatedAt.toISOString(), entity.deletedAt?.toISOString() ?? null, entity.createdBy, entity.updatedBy, JSON.stringify(entity.payload)]);
  }

  async update(entity: Entity): Promise<void> {
    const result = this.database.run('UPDATE entities SET name=?,description=?,payload=?,row_version=?,updated_at=?,updated_by=? WHERE id=? AND row_version=? AND deleted_at IS NULL', [entity.name, entity.description, JSON.stringify(entity.payload), entity.rowVersion, entity.updatedAt.toISOString(), entity.updatedBy, entity.id, entity.rowVersion - 1]);
    if (result.changes > 0) return;
    const row = this.database.get<{ row_version: number; deleted_at: string | null }>('SELECT row_version,deleted_at FROM entities WHERE id=?', [entity.id]);
    if (!row || row.deleted_at !== null) throw new EntityNotFoundError(entity.id);
    throw new RowVersionMismatchError(entity.rowVersion - 1, row.row_version);
  }

  async softDelete(id: string, actorUserId: string, expectedRowVersion: number, deletionBatchId: string): Promise<void> {
    const changedAt = new Date().toISOString();
    const result = this.database.run('UPDATE entities SET deleted_at=?,deletion_batch_id=?,row_version=row_version+1,updated_at=?,updated_by=? WHERE id=? AND row_version=? AND deleted_at IS NULL', [changedAt, deletionBatchId, changedAt, actorUserId, id, expectedRowVersion]);
    if (result.changes > 0) return;
    const row = this.database.get<{ row_version: number; deleted_at: string | null }>('SELECT row_version,deleted_at FROM entities WHERE id=?', [id]);
    if (!row || row.deleted_at !== null) throw new EntityNotFoundError(id);
    throw new RowVersionMismatchError(expectedRowVersion, row.row_version);
  }
  async getDeletionBatchId(entityId: string): Promise<string | null> { return this.database.get<{ deletion_batch_id: string | null }>('SELECT deletion_batch_id FROM entities WHERE id=? AND deleted_at IS NOT NULL', [entityId])?.deletion_batch_id ?? null; }

  async restore(id: string, actorUserId: string, expectedRowVersion: number): Promise<void> {
    const result = this.database.run('UPDATE entities SET deleted_at=NULL,deletion_batch_id=NULL,row_version=row_version+1,updated_at=?,updated_by=? WHERE id=? AND row_version=? AND deleted_at IS NOT NULL', [new Date().toISOString(), actorUserId, id, expectedRowVersion]);
    if (result.changes > 0) return;
    const row = this.database.get<{ row_version: number; deleted_at: string | null }>('SELECT row_version,deleted_at FROM entities WHERE id=?', [id]);
    if (!row || row.deleted_at === null) throw new EntityNotFoundError(id);
    throw new RowVersionMismatchError(expectedRowVersion, row.row_version);
  }

  async listDeletedByScope(actorUserId: string, limit = 100, offset = 0): Promise<DeletedEntitySummary[]> {
    const rows = this.database.all<DeletedEntitySummary>(`SELECT e.id,e.entity_type_id AS entityTypeId,et.name AS entityTypeName,et.is_active AS entityTypeActive,e.parent_node_id AS parentNodeId,n.name AS parentNodeName,e.name,e.description,e.row_version AS rowVersion,e.deleted_at AS deletedAt,e.deletion_batch_id AS deletionBatchId,e.updated_by AS updatedBy FROM entities e JOIN entity_types et ON et.id=e.entity_type_id JOIN nodes n ON n.id=e.parent_node_id WHERE e.deleted_at IS NOT NULL ORDER BY e.deleted_at DESC`);
    if (!this.accessControl) return rows.slice(offset, offset + limit);
    const visible: DeletedEntitySummary[] = [];
    for (const row of rows) {
      if (await this.accessControl.canAccessNodeIncludingDeleted(actorUserId, 'entity.restore', row.parentNodeId)) visible.push(row);
    }
    return visible.slice(offset, offset + limit);
  }

  private find(id: string, deleted: boolean): Entity | null {
    const row = this.database.get<EntityRow>('SELECT * FROM entities WHERE id=? AND deleted_at IS ' + (deleted ? 'NOT NULL' : 'NULL'), [id]);
    return row ? this.map(row) : null;
  }
  private map(row: EntityRow): Entity { return new Entity(row.id, row.entity_type_id, row.parent_node_id, row.name, row.description, row.row_version, new Date(row.created_at), new Date(row.updated_at), row.deleted_at ? new Date(row.deleted_at) : null, row.created_by, row.updated_by, JSON.parse(row.payload) as Record<string, unknown>); }
}
