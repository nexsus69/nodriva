/** Verifies SQLite subtree pagination applies ACL checks in bounded batches. */
import { describe, expect, it, vi } from 'vitest';
import { ensureSqliteSchema } from './SqliteSchema.js';
import { SqliteDatabase } from './SqliteDatabase.js';
import { EntitySubtreeQueryPortSqlite } from './EntitySubtreeQueryPortSqlite.js';
import { AccessControlPortSqlite } from './AccessControlPortSqlite.js';

describe('EntitySubtreeQueryPortSqlite', () => {
  it('applies scoped ACL in the paginated SQL query instead of scanning candidates', async () => {
    const database = new SqliteDatabase();
    ensureSqliteSchema(database);
    const now = new Date('2026-01-01T00:00:00.000Z').toISOString();
    database.run('INSERT INTO node_types (id,type_key,name) VALUES (?,?,?)', ['node-type', 'folder', 'Folder']);
    database.run('INSERT INTO entity_types (id,type_key,name,storage_table) VALUES (?,?,?,?)', ['entity-type', 'record', 'Record', 'entity_data_record']);
    database.run('INSERT INTO users (id,email,is_active,is_super_admin) VALUES (?,?,?,?)', ['actor', 'actor@example.test', 1, 1]);
    database.run('INSERT INTO nodes (id,path,path_label,depth,node_type_id,name,created_at,updated_at,row_version,payload) VALUES (?,?,?,?,?,?,?,?,?,?)', ['root', 'root', 'root', 0, 'node-type', 'Root', now, now, 1, '{}']);
    for (let index = 0; index < 120; index += 1) {
      database.run('INSERT INTO entities (id,entity_type_id,parent_node_id,name,description,row_version,created_at,updated_at,payload) VALUES (?,?,?,?,?,?,?,?,?)', [`entity-${index}`, 'entity-type', 'root', `Entity ${index}`, '', 1, now, now, '{}']);
    }
    const all = vi.spyOn(database, 'all');
    const query = new EntitySubtreeQueryPortSqlite(database, new AccessControlPortSqlite(database));

    const result = await query.findSubtreeEntitiesPaginated({ baseNodeId: 'root', limit: 3, actorUserId: 'actor' });
    expect(result.items.map((item) => item.id)).toEqual(['entity-0', 'entity-1', 'entity-10']);
    expect(result.hasMore).toBe(true);
    expect(all).toHaveBeenCalledTimes(1);
    expect(all.mock.calls[0]?.[0]).toContain('LIMIT ?');
    expect(all.mock.calls[0]?.[1]).toContain(4);
    database.close();
  });

  it('returns backward pages in the same ascending display order as PostgreSQL', async () => {
    const database = new SqliteDatabase();
    ensureSqliteSchema(database);
    const now = new Date('2026-01-01T00:00:00.000Z').toISOString();
    database.run('INSERT INTO users (id,email,is_active,is_super_admin) VALUES (?,?,?,?)', ['actor', 'actor@example.test', 1, 1]);
    database.run('INSERT INTO node_types (id,type_key,name) VALUES (?,?,?)', ['node-type', 'folder', 'Folder']);
    database.run('INSERT INTO entity_types (id,type_key,name,storage_table) VALUES (?,?,?,?)', ['entity-type', 'record', 'Record', 'entity_data_record']);
    database.run('INSERT INTO nodes (id,path,path_label,depth,node_type_id,name,created_at,updated_at,row_version,payload) VALUES (?,?,?,?,?,?,?,?,?,?)', ['root', 'root', 'root', 0, 'node-type', 'Root', now, now, 1, '{}']);
    for (const [id, name] of [['entity-a', 'Alpha'], ['entity-b', 'Bravo'], ['entity-c', 'Charlie']]) {
      database.run('INSERT INTO entities (id,entity_type_id,parent_node_id,name,description,row_version,created_at,updated_at,payload) VALUES (?,?,?,?,?,?,?,?,?)', [id, 'entity-type', 'root', name, '', 1, now, now, '{}']);
    }
    const query = new EntitySubtreeQueryPortSqlite(database, new AccessControlPortSqlite(database));
    const forward = await query.findSubtreeEntitiesPaginated({ baseNodeId: 'root', limit: 2, actorUserId: 'actor' });
    if (!forward.nextCursor) throw new Error('Expected forward cursor.');
    const backward = await query.findSubtreeEntitiesPaginated({ baseNodeId: 'root', limit: 2, actorUserId: 'actor', direction: 'backward', cursor: forward.nextCursor });
    expect(forward.items.map((item) => item.name)).toEqual(['Alpha', 'Bravo']);
    expect(backward.items.map((item) => item.name)).toEqual(['Alpha']);
    database.close();
  });

  it('keeps a local deny effective inside the SQL-paginated subtree', async () => {
    const database = new SqliteDatabase();
    ensureSqliteSchema(database);
    const now = new Date('2026-01-01T00:00:00.000Z').toISOString();
    database.run('INSERT INTO users (id,email,is_active,is_super_admin) VALUES (?,?,?,?)', ['actor', 'actor@example.test', 1, 0]);
    database.run('INSERT INTO roles (id,role_key,name) VALUES (?,?,?)', ['role', 'reader', 'Reader']);
    database.run('INSERT INTO permissions (id,permission_key,name) VALUES (?,?,?)', ['permission', 'entity.read', 'Read entities']);
    database.run('INSERT INTO user_roles (user_id,role_id) VALUES (?,?)', ['actor', 'role']);
    database.run('INSERT INTO role_permissions (role_id,permission_id) VALUES (?,?)', ['role', 'permission']);
    database.run('INSERT INTO node_types (id,type_key,name) VALUES (?,?,?)', ['node-type', 'folder', 'Folder']);
    database.run('INSERT INTO entity_types (id,type_key,name,storage_table) VALUES (?,?,?,?)', ['entity-type', 'record', 'Record', 'entity_data_record']);
    for (const [id, parentId, path] of [['root', null, 'root'], ['allowed', 'root', 'root.allowed'], ['denied', 'root', 'root.denied']]) {
      database.run('INSERT INTO nodes (id,parent_id,path,path_label,depth,node_type_id,name,created_at,updated_at,row_version,payload) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [id, parentId, path, id, String(path).split('.').length - 1, 'node-type', id, now, now, 1, '{}']);
    }
    database.run('INSERT INTO node_hierarchy (ancestor_id,descendant_id,depth) VALUES (?,?,?),(?,?,?),(?,?,?),(?,?,?),(?,?,?)', ['root', 'root', 0, 'allowed', 'allowed', 0, 'denied', 'denied', 0, 'root', 'allowed', 1, 'root', 'denied', 1]);
    database.run('INSERT INTO node_scope_assignments (id,user_id,role_id,node_id,assignment_effect,propagation) VALUES (?,?,?,?,?,?),(?,?,?,?,?,?)', ['allow', 'actor', 'role', 'root', 'allow', 'subtree', 'deny', 'actor', 'role', 'denied', 'deny', 'self']);
    database.run('INSERT INTO entities (id,entity_type_id,parent_node_id,name,description,row_version,created_at,updated_at,payload) VALUES (?,?,?,?,?,?,?,?,?),(?,?,?,?,?,?,?,?,?)', ['entity-allowed', 'entity-type', 'allowed', 'Allowed', '', 1, now, now, '{}', 'entity-denied', 'entity-type', 'denied', 'Denied', '', 1, now, now, '{}']);

    const result = await new EntitySubtreeQueryPortSqlite(database, new AccessControlPortSqlite(database)).findSubtreeEntitiesPaginated({ baseNodeId: 'root', limit: 10, actorUserId: 'actor' });
    expect(result.items.map((item) => item.id)).toEqual(['entity-allowed']);
    database.close();
  });
});
