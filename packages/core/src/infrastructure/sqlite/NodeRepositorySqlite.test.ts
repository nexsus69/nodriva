import { describe, expect, it } from 'vitest';
import { Node } from '../../domain/models/Node.js';
import { ensureSqliteSchema } from './SqliteSchema.js';
import { SqliteDatabase } from './SqliteDatabase.js';
import { NodeRepositorySqlite } from './NodeRepositorySqlite.js';

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
    expect(await repository.listAncestorIds('grandchild')).toEqual(['root', 'child', 'grandchild']);
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
    const repository = new NodeRepositorySqlite(database);
    await repository.create(node('root', null, 'root', 'root', 0));
    await repository.create(node('child', 'root', 'root.child', 'child', 1));

    expect(await repository.softDeleteSubtree('root', 'user', 1, 'batch')).toEqual(['root', 'child']);
    expect(await repository.findById('root')).toBeNull();
    expect((await repository.findDeletedById('child'))?.deletedAt).toBeInstanceOf(Date);
    expect(await repository.restoreSubtree('root', 'user', 2, 'batch')).toEqual(['root', 'child']);
    expect(await repository.findById('child')).not.toBeNull();
    database.close();
  });
});
