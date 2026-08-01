import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageTableManagementPostgres } from './StorageTableManagementPostgres.js';
import { PgExecutor } from './PgExecutor.js';
import { UnsupportedFieldDataTypeError } from '../../domain/errors/SchemaErrors.js';

describe('StorageTableManagementPostgres', () => {
  let mockExecutor: { query: ReturnType<typeof vi.fn> };
  let manager: StorageTableManagementPostgres;

  beforeEach(() => {
    mockExecutor = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    };
    manager = new StorageTableManagementPostgres(mockExecutor as unknown as PgExecutor);
  });

  describe('createStorageTable', () => {
    it('should generate correct CREATE TABLE statement with foreign key', async () => {
      await manager.createStorageTable('entity_device');

      expect(mockExecutor.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE "entity_device"')
      );
      expect(mockExecutor.query).toHaveBeenCalledWith(
        expect.stringContaining('entity_id UUID PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE')
      );
    });

    it('should safely escape table names containing quotes', async () => {
      await manager.createStorageTable('entity_"bad"');

      expect(mockExecutor.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE "entity_""bad"""')
      );
    });
  });

  describe('addColumn', () => {
    it('should generate correct ALTER TABLE ADD COLUMN statement', async () => {
      await manager.addColumn('entity_device', 'serial_number', 'string', true, false, null);

      expect(mockExecutor.query).toHaveBeenCalledWith(
        'ALTER TABLE "entity_device" ADD COLUMN "serial_number" TEXT NOT NULL'
      );
    });

    it('should handle nullable columns without NOT NULL', async () => {
      await manager.addColumn('entity_device', 'firmware', 'varchar', false, false, null);

      expect(mockExecutor.query).toHaveBeenCalledWith(
        'ALTER TABLE "entity_device" ADD COLUMN "firmware" TEXT'
      );
    });

    it('should support default values with proper type casting', async () => {
      await manager.addColumn('entity_device', 'is_active', 'boolean', true, false, 'true');

      expect(mockExecutor.query).toHaveBeenCalledWith(
        "ALTER TABLE " + '"entity_device" ADD COLUMN "is_active" BOOLEAN DEFAULT \'true\'::BOOLEAN NOT NULL'
      );
    });

    it('should support integer and numeric types', async () => {
      await manager.addColumn('entity_device', 'count', 'integer', true, false, '0');

      expect(mockExecutor.query).toHaveBeenCalledWith(
        "ALTER TABLE " + '"entity_device" ADD COLUMN "count" INTEGER DEFAULT \'0\'::INTEGER NOT NULL'
      );
    });

    it('should support decimal and float types mapping to NUMERIC', async () => {
      await manager.addColumn('entity_device', 'temperature', 'decimal', true, false, null);

      expect(mockExecutor.query).toHaveBeenCalledWith(
        'ALTER TABLE "entity_device" ADD COLUMN "temperature" NUMERIC NOT NULL'
      );
    });

    it('should automatically invoke createUniqueConstraint if isUnique is true', async () => {
      await manager.addColumn('entity_device', 'mac_address', 'string', true, true, null);

      // 1. ADD COLUMN
      expect(mockExecutor.query).toHaveBeenNthCalledWith(
        1,
        'ALTER TABLE "entity_device" ADD COLUMN "mac_address" TEXT NOT NULL'
      );
      // 2. ADD UNIQUE CONSTRAINT
      expect(mockExecutor.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('ADD CONSTRAINT "uq_entity_device_mac_address" UNIQUE ("mac_address")')
      );
    });

    it('should throw UnsupportedFieldDataTypeError on invalid type', async () => {
      await expect(
        manager.addColumn('entity_device', 'data', 'blob', true, false, null)
      ).rejects.toThrow(UnsupportedFieldDataTypeError);
    });
  });

  describe('updateColumnNullability', () => {
    it('should generate SET NOT NULL statement', async () => {
      await manager.updateColumnNullability('entity_device', 'firmware', true);

      expect(mockExecutor.query).toHaveBeenCalledWith(
        'ALTER TABLE "entity_device" ALTER COLUMN "firmware" SET NOT NULL'
      );
    });

    it('should generate DROP NOT NULL statement', async () => {
      await manager.updateColumnNullability('entity_device', 'firmware', false);

      expect(mockExecutor.query).toHaveBeenCalledWith(
        'ALTER TABLE "entity_device" ALTER COLUMN "firmware" DROP NOT NULL'
      );
    });
  });

  describe('updateColumnDefault', () => {
    it('should generate DROP DEFAULT statement if default is null', async () => {
      await manager.updateColumnDefault('entity_device', 'firmware', null);

      expect(mockExecutor.query).toHaveBeenCalledWith(
        'ALTER TABLE "entity_device" ALTER COLUMN "firmware" DROP DEFAULT'
      );
    });

    it('should retrieve type from information_schema and generate SET DEFAULT statement with cast', async () => {
      mockExecutor.query.mockResolvedValueOnce({
        rows: [{ data_type: 'integer' }],
        rowCount: 1,
      });

      await manager.updateColumnDefault('entity_device', 'version', '1');

      // 1. query metadata
      expect(mockExecutor.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('FROM information_schema.columns'),
        ['entity_device', 'version']
      );

      // 2. ALTER COLUMN SET DEFAULT
      expect(mockExecutor.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("ALTER COLUMN \"version\" SET DEFAULT '1'::INTEGER")
      );
    });
  });

  describe('dropColumn', () => {
    it('should generate DROP COLUMN statement', async () => {
      await manager.dropColumn('entity_device', 'old_field');

      expect(mockExecutor.query).toHaveBeenCalledWith(
        'ALTER TABLE "entity_device" DROP COLUMN "old_field"'
      );
    });
  });

  describe('unique constraints and indexes', () => {
    it('should generate CREATE UNIQUE CONSTRAINT', async () => {
      await manager.createUniqueConstraint('entity_device', 'serial');

      expect(mockExecutor.query).toHaveBeenCalledWith(
        expect.stringContaining('ADD CONSTRAINT "uq_entity_device_serial" UNIQUE ("serial")')
      );
    });

    it('should generate DROP CONSTRAINT', async () => {
      await manager.dropUniqueConstraint('entity_device', 'serial');

      expect(mockExecutor.query).toHaveBeenCalledWith(
        expect.stringContaining('DROP CONSTRAINT "uq_entity_device_serial"')
      );
    });

    it('should generate CREATE INDEX', async () => {
      await manager.createIndex('entity_device', 'created_at');

      expect(mockExecutor.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX "idx_entity_device_created_at" ON "entity_device" ("created_at")')
      );
    });

    it('should generate DROP INDEX', async () => {
      await manager.dropIndex('entity_device', 'created_at');

      expect(mockExecutor.query).toHaveBeenCalledWith(
        'DROP INDEX "idx_entity_device_created_at"'
      );
    });
  });
});
