/** Verifies ACL and causal-root filtering for the SQLite recycle bin. */
import { describe, expect, it } from 'vitest';
import { Entity } from '../../domain/models/Entity.js';
import { Node } from '../../domain/models/Node.js';
import { AccessControlPortSqlite } from './AccessControlPortSqlite.js';
import { EntityRepositorySqlite } from './EntityRepositorySqlite.js';
import { NodeRepositorySqlite } from './NodeRepositorySqlite.js';
import { SqliteDatabase } from './SqliteDatabase.js';
import { ensureSqliteSchema } from './SqliteSchema.js';

const now = new Date('2026-01-01T00:00:00.000Z');

describe('SQLite recycle-bin scope filtering', () => {
  it('returns only independently actionable deletes covered by restore permissions', async () => {
    const database = new SqliteDatabase();
    ensureSqliteSchema(database);
    const access = new AccessControlPortSqlite(database);
    const nodes = new NodeRepositorySqlite(database, access);
    const entities = new EntityRepositorySqlite(database, access);
    database.run('INSERT INTO node_types(id,type_key,name) VALUES (?,?,?)', ['node-type', 'folder', 'Folder']);
    database.run('INSERT INTO entity_types(id,type_key,name,storage_table) VALUES (?,?,?,?)', ['entity-type', 'item', 'Item', 'entity_data_item']);
    database.run('INSERT INTO users(id,email,password_hash,is_active,is_super_admin,row_version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)', ['actor', 'actor@test.local', 'hash', 1, 0, 1, now.toISOString(), now.toISOString()]);
    for (const [id, key] of [['node-restore', 'node.restore'], ['entity-restore', 'entity.restore']]) {
      database.run('INSERT INTO permissions(id,permission_key,name) VALUES (?,?,?)', [id, key, key]);
    }
    database.run('INSERT INTO roles(id,role_key,name) VALUES (?,?,?)', ['role', 'restorer', 'Restorer']);
    database.run('INSERT INTO role_permissions(role_id,permission_id) VALUES (?,?),(?,?)', ['role', 'node-restore', 'role', 'entity-restore']);

    const createNode = (id: string) => nodes.create(new Node(id, null, id, id, 0, 'node-type', id, '', 1, now, now, null, 'actor', 'actor'));
    await createNode('visible');
    await createNode('hidden');
    database.run("INSERT INTO node_scope_assignments(id,user_id,role_id,node_id,assignment_effect,propagation) VALUES (?,?,?,?, 'allow','subtree')", ['assignment', 'actor', 'role', 'visible']);
    await entities.create(new Entity('visible-entity', 'entity-type', 'visible', 'Visible entity', '', 1, now, now, null, 'actor', 'actor', {}));
    await entities.create(new Entity('hidden-entity', 'entity-type', 'hidden', 'Hidden entity', '', 1, now, now, null, 'actor', 'actor', {}));

    await nodes.softDeleteSubtree('visible', 'actor', 1, 'visible-batch');
    await nodes.softDeleteSubtree('hidden', 'actor', 1, 'hidden-batch');

    expect((await nodes.listDeletedByScope('actor')).map((row) => row.id)).toEqual(['visible']);
    expect((await entities.listDeletedByScope('actor')).map((row) => row.id)).toEqual([]);
    database.close();
  });
});
