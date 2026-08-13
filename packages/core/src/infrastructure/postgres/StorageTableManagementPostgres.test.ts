import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageTableManagementPostgres } from './StorageTableManagementPostgres.js';
import type { PgExecutor } from './PgExecutor.js';

describe('StorageTableManagementPostgres', () => {
  let mockExecutor: { query: ReturnType<typeof vi.fn> };
  let manager: StorageTableManagementPostgres;

  beforeEach(() => {
    mockExecutor = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    manager = new StorageTableManagementPostgres(mockExecutor as unknown as PgExecutor);
  });

  it('delegates storage table creation to the controlled DDL gateway', async () => {
    await manager.createStorageTable('entity_device');
    expect(mockExecutor.query).toHaveBeenCalledWith('SELECT public.dashboard_schema_create_entity_table($1)', ['entity_device']);
  });

  it('delegates physical column creation with metadata arguments', async () => {
    await manager.addColumn('entity_device', 'serial_number', 'string', true, false, null);
    expect(mockExecutor.query).toHaveBeenCalledWith(
      'SELECT public.dashboard_schema_add_entity_column($1, $2, $3, $4, $5, $6)',
      ['entity_device', 'serial_number', 'string', true, false, null],
    );
  });

  it('does not request a physical column for attachment fields', async () => {
    await manager.addColumn('entity_device', 'document', 'file', false, false, null);
    expect(mockExecutor.query).not.toHaveBeenCalled();
  });

  it('delegates column lifecycle and index operations to controlled functions', async () => {
    await manager.updateColumnNullability('entity_device', 'serial_number', true);
    await manager.updateColumnDefault('entity_device', 'serial_number', '1');
    await manager.dropColumn('entity_device', 'serial_number');
    await manager.createUniqueConstraint('entity_device', 'serial_number');
    await manager.dropUniqueConstraint('entity_device', 'serial_number');
    await manager.createIndex('entity_device', 'serial_number');
    await manager.dropIndex('entity_device', 'serial_number');

    expect(mockExecutor.query.mock.calls.map(([sql]) => sql)).toEqual([
      'SELECT public.dashboard_schema_update_entity_nullability($1, $2, $3)',
      'SELECT public.dashboard_schema_update_entity_default($1, $2, $3)',
      'SELECT public.dashboard_schema_drop_entity_column($1, $2)',
      'SELECT public.dashboard_schema_create_entity_unique($1, $2)',
      'SELECT public.dashboard_schema_drop_entity_unique($1, $2)',
      'SELECT public.dashboard_schema_create_entity_index($1, $2)',
      'SELECT public.dashboard_schema_drop_entity_index($1, $2)',
    ]);
  });
});
