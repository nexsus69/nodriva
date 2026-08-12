import { describe, expect, it } from 'vitest';
import { SqliteDatabase } from './SqliteDatabase.js';
import { ensureSqliteSchema } from './SqliteSchema.js';
import { NodeTypeRepositorySqlite } from './NodeTypeRepositorySqlite.js';
import { EntityTypeRepositorySqlite } from './EntityTypeRepositorySqlite.js';

describe('SQLite type repositories', () => {
  it('hide inactive and soft-deleted types consistently', async () => {
    const database = new SqliteDatabase(); ensureSqliteSchema(database);
    database.run('INSERT INTO node_types (id,type_key,name,is_active) VALUES (?,?,?,?)', ['n1', 'active', 'Active', 1]);
    database.run('INSERT INTO node_types (id,type_key,name,is_active) VALUES (?,?,?,?)', ['n2', 'inactive', 'Inactive', 0]);
    database.run('INSERT INTO entity_types (id,type_key,name,storage_table,is_active) VALUES (?,?,?,?,?)', ['e1', 'active', 'Active', 'entity_active', 1]);
    database.run('INSERT INTO entity_types (id,type_key,name,storage_table,is_active,deleted_at) VALUES (?,?,?,?,?,?)', ['e2', 'deleted', 'Deleted', 'entity_deleted', 1, '2026-01-01T00:00:00Z']);
    await expect(new NodeTypeRepositorySqlite(database).listAll()).resolves.toHaveLength(1);
    await expect(new NodeTypeRepositorySqlite(database).findByKey('inactive')).resolves.toBeNull();
    await expect(new EntityTypeRepositorySqlite(database).listAll()).resolves.toHaveLength(1);
    database.close();
  });
});
