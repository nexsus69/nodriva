import { describe, expect, it } from 'vitest';
import { Entity } from '../../domain/models/Entity.js';
import { ensureSqliteSchema } from './SqliteSchema.js';
import { SqliteDatabase } from './SqliteDatabase.js';
import { EntityRepositorySqlite } from './EntityRepositorySqlite.js';

describe('EntityRepositorySqlite', () => {
  it('stores JSON payloads and preserves optimistic versions', async () => {
    const database = new SqliteDatabase(); ensureSqliteSchema(database);
    database.run('INSERT INTO node_types (id,type_key,name) VALUES (?,?,?)', ['n', 'folder', 'Folder']);
    database.run('INSERT INTO entity_types (id,type_key,name,storage_table) VALUES (?,?,?,?)', ['t', 'record', 'Record', 'entity_record']);
    database.run('INSERT INTO nodes (id,path,path_label,depth,node_type_id,name,created_at,updated_at,row_version,payload) VALUES (?,?,?,?,?,?,?,?,?,?)', ['node', 'root', 'root', 0, 'n', 'Root', new Date().toISOString(), new Date().toISOString(), 1, '{}']);
    const repository = new EntityRepositorySqlite(database);
    const entity = Entity.create('entity', 't', 'node', 'Example', '', 'user', { score: 42, active: true });
    await repository.create(entity);
    await expect(repository.findById('entity')).resolves.toMatchObject({ payload: { score: 42, active: true } });
    await repository.update(entity.update('Changed', '', { score: 43 }, 'user'));
    await expect(repository.findById('entity')).resolves.toMatchObject({ rowVersion: 2, name: 'Changed', payload: { score: 43 } });
    await repository.softDelete('entity', 'user', 2);
    await expect(repository.findById('entity')).resolves.toBeNull();
    await repository.restore('entity', 'user', 3);
    await expect(repository.findById('entity')).resolves.not.toBeNull();
    database.close();
  });
});
