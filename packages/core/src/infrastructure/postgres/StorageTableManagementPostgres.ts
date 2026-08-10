import { StorageTableManagementPort } from '../../application/ports/StorageTableManagementPort.js';
import { PgExecutor } from './PgExecutor.js';

/**
 * PostgreSQL adapter for dynamic entity storage DDL.
 *
 * The web role never receives direct ALTER/CREATE/DROP privileges. Every
 * operation is delegated to a parameterized, metadata-validating SECURITY
 * DEFINER function installed by the database migration.
 */
export class StorageTableManagementPostgres implements StorageTableManagementPort {
  constructor(private readonly executor: PgExecutor) {}

  async createStorageTable(storageTable: string): Promise<void> {
    await this.executor.query('SELECT public.dashboard_schema_create_entity_table($1)', [storageTable]);
  }

  async addColumn(
    storageTable: string,
    columnName: string,
    dataType: string,
    isRequired: boolean,
    isUnique: boolean,
    defaultValueText: string | null,
  ): Promise<void> {
    if (['file', 'image'].includes(dataType.toLowerCase())) return;
    await this.executor.query(
      'SELECT public.dashboard_schema_add_entity_column($1, $2, $3, $4, $5, $6)',
      [storageTable, columnName, dataType, isRequired, isUnique, defaultValueText],
    );
  }

  async updateColumnNullability(storageTable: string, columnName: string, isRequired: boolean): Promise<void> {
    await this.executor.query('SELECT public.dashboard_schema_update_entity_nullability($1, $2, $3)', [storageTable, columnName, isRequired]);
  }

  async updateColumnDefault(storageTable: string, columnName: string, defaultValueText: string | null): Promise<void> {
    await this.executor.query('SELECT public.dashboard_schema_update_entity_default($1, $2, $3)', [storageTable, columnName, defaultValueText]);
  }

  async dropColumn(storageTable: string, columnName: string): Promise<void> {
    await this.executor.query('SELECT public.dashboard_schema_drop_entity_column($1, $2)', [storageTable, columnName]);
  }

  async createUniqueConstraint(storageTable: string, columnName: string): Promise<void> {
    await this.executor.query('SELECT public.dashboard_schema_create_entity_unique($1, $2)', [storageTable, columnName]);
  }

  async dropUniqueConstraint(storageTable: string, columnName: string): Promise<void> {
    await this.executor.query('SELECT public.dashboard_schema_drop_entity_unique($1, $2)', [storageTable, columnName]);
  }

  async createIndex(storageTable: string, columnName: string): Promise<void> {
    await this.executor.query('SELECT public.dashboard_schema_create_entity_index($1, $2)', [storageTable, columnName]);
  }

  async dropIndex(storageTable: string, columnName: string): Promise<void> {
    await this.executor.query('SELECT public.dashboard_schema_drop_entity_index($1, $2)', [storageTable, columnName]);
  }
}
