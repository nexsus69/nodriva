import type { StorageTableManagementPort } from '../../application/ports/StorageTableManagementPort.js';
import type { SqliteDatabase } from './SqliteDatabase.js';

const identifier = (value: string): string => { if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) throw new Error('Invalid SQLite schema identifier.'); return value; };

/** SQLite keeps dynamic fields in entity JSON; this adapter persists the field schema metadata. */
export class StorageTableManagementSqlite implements StorageTableManagementPort {
  constructor(private readonly database: SqliteDatabase) {
    this.database.protectAsyncMethods(this);
  }
  async createStorageTable(storageTable: string): Promise<void> { identifier(storageTable); }
  async addColumn(storageTable: string, columnName: string, dataType: string, isRequired: boolean, isUnique: boolean, defaultValueText: string | null): Promise<void> { const table = identifier(storageTable); const type = identifier(columnName); const entityType = this.database.get<{ id: string }>('SELECT id FROM entity_types WHERE storage_table=?', [table]); if (!entityType) throw new Error(`Entity type storage '${table}' was not found.`); this.database.run('INSERT INTO entity_type_fields (entity_type_id,field_key,column_name,data_type,is_required,is_unique,default_value) VALUES (?,?,?,?,?,?,?) ON CONFLICT(entity_type_id,field_key) DO UPDATE SET column_name=excluded.column_name,data_type=excluded.data_type,is_required=excluded.is_required,is_unique=excluded.is_unique,default_value=excluded.default_value', [entityType.id, type, type, dataType, isRequired ? 1 : 0, isUnique ? 1 : 0, defaultValueText]); }
  async updateColumnNullability(storageTable: string, columnName: string, isRequired: boolean): Promise<void> { this.update(storageTable, columnName, 'is_required', isRequired ? 1 : 0); }
  async updateColumnDefault(storageTable: string, columnName: string, defaultValueText: string | null): Promise<void> { this.update(storageTable, columnName, 'default_value', defaultValueText); }
  async dropColumn(storageTable: string, columnName: string): Promise<void> { const entityType = this.entityType(storageTable); this.database.run('DELETE FROM entity_type_fields WHERE entity_type_id=? AND column_name=?', [entityType, identifier(columnName)]); }
  async createUniqueConstraint(storageTable: string, columnName: string): Promise<void> { this.update(storageTable, columnName, 'is_unique', 1); }
  async dropUniqueConstraint(storageTable: string, columnName: string): Promise<void> { this.update(storageTable, columnName, 'is_unique', 0); }
  async createIndex(storageTable: string, columnName: string): Promise<void> { identifier(storageTable); identifier(columnName); }
  async dropIndex(storageTable: string, columnName: string): Promise<void> { identifier(storageTable); identifier(columnName); }
  private entityType(storageTable: string): string { const row = this.database.get<{ id: string }>('SELECT id FROM entity_types WHERE storage_table=?', [identifier(storageTable)]); if (!row) throw new Error(`Entity type storage '${storageTable}' was not found.`); return row.id; }
  private update(storageTable: string, columnName: string, column: string, value: unknown): void { const entityType = this.entityType(storageTable); this.database.run(`UPDATE entity_type_fields SET ${column}=? WHERE entity_type_id=? AND column_name=?`, [value, entityType, identifier(columnName)]); }
}
