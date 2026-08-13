import { describe, expect, it } from 'vitest';
import { Node } from '../../domain/models/Node.js';
import { ensureSqliteSchema } from './SqliteSchema.js';
import { SqliteDatabase } from './SqliteDatabase.js';
import { NodeRepositorySqlite } from './NodeRepositorySqlite.js';
import { LockConflictError } from '../../domain/errors/ApplicationErrors.js';

const now = new Date('2026-01-01T00:00:00.000Z');
const node = (id: string, parentId: string | null, path: string, label: string, depth: number) => new Node(id, parentId, path, label, depth, 'type', label, '', 1, now, now, null, 'user', 'user', { value: id });

describe('NodeRepositorySqlite', () => {
  it('persists hierarchy, moves subtrees and resolves ancestors', async () => {
    const database = new SqliteDatabase();
    ensureSqliteSchema(database);
    database.run('INSERT INTO node_types (id,type_key,name) VALUES (?,?,?)', ['type', 'folder', 'Folder']);
    const repository = new NodeRepositorySqlite(database);
    await repository.create(node('root', null, 'root', 'root', 0));
    await repository.create(node('child', 'root', 'root.child', 'child', 1));
    await repository.create(node('other', null, 'other', 'other', 0));
    await repository.create(node('grandchild', 'child', 'root.child.grandchild', 'grandchild', 2));

    expect((await repository.listSubtree('root')).map((item) => item.id)).toEqual(['root', 'child', 'grandchild']);
    expect(await repository.listAncestorIds('grandchild')).toEqual(['grandchild', 'child', 'root']);
    expect(await repository.isDescendantOf('grandchild', 'root')).toBe(true);

    await repository.moveSubtree('child', 'other', 'user');
    expect((await repository.findById('grandchild'))?.path).toBe('other.child.grandchild');
    expect((await repository.findById('grandchild'))?.depth).toBe(2);
    database.close();
  });

  it('soft-deletes and restores a subtree by immutable batch id', async () => {
    const database = new SqliteDatabase();
    ensureSqliteSchema(database);
    database.run('INSERT INTO node_types (id,type_key,name) VALUES (?,?,?)', ['type', 'folder', 'Folder']);
    database.run('INSERT INTO entity_types (id,type_key,name,storage_table) VALUES (?,?,?,?)', ['entity-type', 'item', 'Item', 'entity_data_item']);
    const repository = new NodeRepositorySqlite(database);
    await repository.create(node('root', null, 'root', 'root', 0));
    await repository.create(node('child', 'root', 'root.child', 'child', 1));
    database.run('INSERT INTO entities (id,entity_type_id,parent_node_id,name,row_version,created_at,updated_at,payload) VALUES (?,?,?,?,?,?,?,?)', ['entity', 'entity-type', 'child', 'Entity', 1, now.toISOString(), now.toISOString(), '{}']);

    expect(await repository.softDeleteSubtree('root', 'user', 1, 'batch')).toEqual(['root', 'child']);
    expect(await repository.findById('root')).toBeNull();
    expect((await repository.findDeletedById('child'))?.deletedAt).toBeInstanceOf(Date);
    expect(database.get<{ deletion_batch_id: string }>('SELECT deletion_batch_id FROM entities WHERE id=? AND deleted_at IS NOT NULL', ['entity'])?.deletion_batch_id).toBe('batch');
    expect(await repository.restoreSubtree('root', 'user', 2, 'batch')).toEqual(['root', 'child']);
    expect(await repository.findById('child')).not.toBeNull();
    expect(database.get('SELECT 1 FROM entities WHERE id=? AND deleted_at IS NULL', ['entity'])).toBeDefined();
    database.close();
  });

  it('rejects subtree deletion when another user owns a descendant lock', async () => {
    const database = new SqliteDatabase();
    ensureSqliteSchema(database);
    database.run('INSERT INTO node_types (id,type_key,name) VALUES (?,?,?)', ['type', 'folder', 'Folder']);
    const repository = new NodeRepositorySqlite(database);
    await repository.create(node('root', null, 'root', 'root', 0));
    await repository.create(node('child', 'root', 'root.child', 'child', 1));
    database.run('INSERT INTO locks (id,resource_type,resource_id,user_id,session_id,acquired_at,expires_at) VALUES (?,?,?,?,?,?,?)', ['lock', 'node', 'child', 'other-user', 'session', now.toISOString(), '2999-01-01T00:00:00.000Z']);

    await expect(repository.assertSubtreeUnlocked('root', 'actor')).rejects.toBeInstanceOf(LockConflictError);
    await expect(repository.assertSubtreeUnlocked('root', 'other-user')).resolves.toBeUndefined();
    database.close();
  });

  it('allows reuse of a sibling label after soft deletion', async () => {
    const database = new SqliteDatabase();
    ensureSqliteSchema(database);
    database.run('INSERT INTO node_types (id,type_key,name) VALUES (?,?,?)', ['type', 'folder', 'Folder']);
    const repository = new NodeRepositorySqlite(database);
    await repository.create(node('root', null, 'root', 'root', 0));
    await repository.create(node('old-child', 'root', 'root.child', 'child', 1));
    await repository.softDeleteSubtree('old-child', 'user', 1, 'batch');

    await expect(repository.create(node('new-child', 'root', 'root.child', 'child', 1))).resolves.toBeUndefined();
    database.close();
  });
});
