import { describe, expect, it } from 'vitest';
import { SqliteDatabase } from './SqliteDatabase.js';
import { ensureSqliteSchema } from './SqliteSchema.js';
import { StorageTableManagementSqlite } from './StorageTableManagementSqlite.js';

describe('StorageTableManagementSqlite', () => {
  it('stores dynamic field metadata without unsafe DDL', async () => {
    const database = new SqliteDatabase(); ensureSqliteSchema(database);
    database.run('INSERT INTO entity_types (id,type_key,name,storage_table) VALUES (?,?,?,?)', ['type', 'record', 'Record', 'entity_record']);
    const storage = new StorageTableManagementSqlite(database);
    await storage.createStorageTable('entity_record');
    await storage.addColumn('entity_record', 'title', 'string', true, false, null);
    await storage.updateColumnDefault('entity_record', 'title', 'untitled');
    expect(database.get('SELECT data_type,is_required,default_value FROM entity_type_fields')).toEqual({ data_type: 'string', is_required: 1, default_value: 'untitled' });
    await expect(storage.addColumn('entity_record', 'bad-name', 'string', false, false, null)).rejects.toThrow('Invalid SQLite schema identifier');
    database.close();
  });
});
