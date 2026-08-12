import { describe, expect, it } from 'vitest';
import { ensureSqliteSchema } from './SqliteSchema.js';
import { SqliteDatabase } from './SqliteDatabase.js';
import { AccessControlPortSqlite } from './AccessControlPortSqlite.js';

describe('AccessControlPortSqlite', () => {
  it('enforces self/subtree allows and deny overrides', async () => {
    const database = new SqliteDatabase(); ensureSqliteSchema(database);
    for (const id of ['root', 'child']) database.run('INSERT INTO node_types (id,type_key,name) VALUES (?,?,?)', [`type-${id}`, id, id]);
    const now = new Date().toISOString();
    database.run('INSERT INTO nodes (id,path,path_label,depth,node_type_id,name,created_at,updated_at,row_version,payload) VALUES (?,?,?,?,?,?,?,?,?,?)', ['root', 'root', 'root', 0, 'type-root', 'Root', now, now, 1, '{}']);
    database.run('INSERT INTO nodes (id,parent_id,path,path_label,depth,node_type_id,name,created_at,updated_at,row_version,payload) VALUES (?,?,?,?,?,?,?,?,?,?,?)', ['child', 'root', 'root.child', 'child', 1, 'type-child', 'Child', now, now, 1, '{}']);
    const acl = new AccessControlPortSqlite(database);
    database.run('INSERT INTO users (id) VALUES (?)', ['user']); database.run('INSERT INTO roles (id,role_key) VALUES (?,?)', ['role', 'reader']); database.run('INSERT INTO permissions (id,permission_key) VALUES (?,?)', ['perm', 'node.read']); database.run('INSERT INTO user_roles VALUES (?,?)', ['user', 'role']); database.run('INSERT INTO role_permissions VALUES (?,?)', ['role', 'perm']);
    database.run('INSERT INTO node_scope_assignments VALUES (?,?,?,?,?,?)', ['allow', 'user', 'role', 'root', 'allow', 'subtree']);
    await expect(acl.assertCanReadNode('user', 'child')).resolves.toBeUndefined();
    database.run('INSERT INTO node_scope_assignments VALUES (?,?,?,?,?,?)', ['deny', 'user', 'role', 'child', 'deny', 'self']);
    await expect(acl.assertCanReadNode('user', 'child')).rejects.toThrow('lacks permission');
    await expect(acl.assertCanReadNode('user', 'root')).resolves.toBeUndefined();
    database.close();
  });
});
