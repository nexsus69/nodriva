/** Exercises SQLite scoped ACL checks and batch read visibility. */
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
    database.run('INSERT INTO node_hierarchy VALUES (?,?,?)', ['root', 'root', 0]);
    database.run('INSERT INTO node_hierarchy VALUES (?,?,?)', ['child', 'child', 0]);
    database.run('INSERT INTO node_hierarchy VALUES (?,?,?)', ['root', 'child', 1]);
    const acl = new AccessControlPortSqlite(database);
    database.run('INSERT INTO users (id) VALUES (?)', ['user']); database.run('INSERT INTO roles (id,role_key) VALUES (?,?)', ['role', 'reader']); database.run('INSERT INTO permissions (id,permission_key) VALUES (?,?)', ['perm', 'node.read']); database.run('INSERT INTO user_roles VALUES (?,?)', ['user', 'role']); database.run('INSERT INTO role_permissions VALUES (?,?)', ['role', 'perm']);
    database.run('INSERT INTO node_scope_assignments VALUES (?,?,?,?,?,?)', ['allow', 'user', 'role', 'root', 'allow', 'subtree']);
    await expect(acl.assertCanReadNode('user', 'child')).resolves.toBeUndefined();
    await expect(acl.assertHasPermissionCoverage('user', 'node.read', 'root', 'subtree')).resolves.toBeUndefined();
    database.run('INSERT INTO node_scope_assignments VALUES (?,?,?,?,?,?)', ['deny', 'user', 'role', 'child', 'deny', 'self']);
    await expect(acl.assertCanReadNode('user', 'child')).rejects.toThrow('lacks permission');
    await expect(acl.assertCanReadNode('user', 'root')).resolves.toBeUndefined();
    await expect(acl.assertHasPermissionCoverage('user', 'node.read', 'root', 'subtree')).rejects.toThrow('lacks subtree permission');
    await expect(acl.listReadableResourceIds('user', 'node', ['child', 'root'])).resolves.toEqual(['root']);
    database.close();
  });

  it('does not treat permission display names as technical permission keys', async () => {
    const database = new SqliteDatabase(); ensureSqliteSchema(database);
    const now = new Date().toISOString();
    database.run('INSERT INTO node_types (id,type_key,name) VALUES (?,?,?)', ['type-root', 'root', 'Root']);
    database.run('INSERT INTO nodes (id,path,path_label,depth,node_type_id,name,created_at,updated_at,row_version,payload) VALUES (?,?,?,?,?,?,?,?,?,?)', ['root', 'root', 'root', 0, 'type-root', 'Root', now, now, 1, '{}']);
    database.run('INSERT INTO node_hierarchy VALUES (?,?,?)', ['root', 'root', 0]);
    database.run('INSERT INTO users (id) VALUES (?)', ['user']);
    database.run('INSERT INTO roles (id,role_key) VALUES (?,?)', ['role', 'misleading-role']);
    database.run('INSERT INTO permissions (id,permission_key,name) VALUES (?,?,?)', ['misleading-perm', 'custom.not-node-read', 'node.read']);
    database.run('INSERT INTO user_roles VALUES (?,?)', ['user', 'role']);
    database.run('INSERT INTO role_permissions VALUES (?,?)', ['role', 'misleading-perm']);
    database.run('INSERT INTO node_scope_assignments VALUES (?,?,?,?,?,?)', ['allow', 'user', 'role', 'root', 'allow', 'subtree']);
    const acl = new AccessControlPortSqlite(database);

    await expect(acl.assertCanReadNode('user', 'root')).rejects.toThrow('lacks permission');
    database.close();
  });
});
