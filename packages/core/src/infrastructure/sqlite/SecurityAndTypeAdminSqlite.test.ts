import { describe, expect, it } from 'vitest';
import { ManagedTypeDefinition } from '../../domain/models/ManagedTypeDefinition.js';
import { SecurityAdminValidationError } from '../../domain/errors/SecurityAdminErrors.js';
import { SecurityRepositorySqlite } from './SecurityRepositorySqlite.js';
import { SqliteDatabase } from './SqliteDatabase.js';
import { ensureSqliteSchema } from './SqliteSchema.js';
import { TypeDefinitionAdminRepositorySqlite } from './TypeDefinitionAdminRepositorySqlite.js';

const now = new Date('2026-08-13T00:00:00.000Z');

function setup(): SqliteDatabase {
  const database = new SqliteDatabase();
  ensureSqliteSchema(database);
  database.run('INSERT INTO node_types(id,type_key,name) VALUES(?,?,?)', ['node-type', 'folder', 'Folder']);
  database.run('INSERT INTO nodes(id,parent_id,path,path_label,depth,node_type_id,name,row_version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)', ['root', null, 'root', 'root', 0, 'node-type', 'Root', 1, now.toISOString(), now.toISOString()]);
  return database;
}

describe('SQLite security and type-admin contract', () => {
  it('supports the admin type schema and scopes incoming relations by domain', async () => {
    const database = setup();
    const repository = new TypeDefinitionAdminRepositorySqlite(database);
    const type = new ManagedTypeDefinition('entity-type', 'asset', 'Asset', '', 'assets', null, 1, true, false, 1, now, now, null);
    await repository.createType('entity', type);
    database.run(`INSERT INTO node_type_fields(id,node_type_id,field_key,label,column_name,data_type,relation_target_domain,relation_target_type_key) VALUES(?,?,?,?,?,?,?,?)`, ['node-relation', 'node-type', 'asset_ref', 'Asset', 'asset_ref', 'relation', 'entity', 'asset']);
    database.run(`INSERT INTO entity_type_fields(id,entity_type_id,field_key,label,column_name,data_type,relation_target_domain,relation_target_type_key) VALUES(?,?,?,?,?,?,?,?)`, ['entity-relation', 'entity-type', 'folder_ref', 'Folder', 'folder_ref', 'relation', 'node', 'asset']);
    await expect(repository.getTypeDetail('entity', 'asset')).resolves.toMatchObject({ id: 'entity-type', storageTable: 'assets', rowVersion: 1 });
    await expect(repository.countIncomingRelations('entity', 'asset')).resolves.toBe(1);
    await expect(repository.countIncomingRelations('node', 'asset')).resolves.toBe(1);
    database.close();
  });

  it('validates assignment targets, exposes direct global permissions, and revokes uncovered delegations', async () => {
    const database = setup();
    database.run('INSERT INTO users(id,email,is_active,is_super_admin) VALUES(?,?,?,?)', ['delegator', 'delegator@example.test', 1, 0]);
    database.run('INSERT INTO users(id,email,is_active,is_super_admin) VALUES(?,?,?,?)', ['target', 'target@example.test', 1, 0]);
    database.run('INSERT INTO users(id,email,is_active,is_super_admin) VALUES(?,?,?,?)', ['inactive', 'inactive@example.test', 0, 0]);
    database.run('INSERT INTO roles(id,role_key,name) VALUES(?,?,?)', ['reader-role', 'scoped_reader', 'Reader']);
    database.run('INSERT INTO roles(id,role_key,name) VALUES(?,?,?)', ['admin-role', 'admin_role', 'Admin']);
    database.run('INSERT INTO permissions(id,permission_key,name) VALUES(?,?,?)', ['node-read', 'node.read', 'Node read']);
    database.run('INSERT INTO permissions(id,permission_key,name) VALUES(?,?,?)', ['scope-read', 'scope.read', 'Scope read']);
    database.run('INSERT INTO role_permissions(role_id,permission_id) VALUES(?,?)', ['reader-role', 'node-read']);
    database.run('INSERT INTO role_permissions(role_id,permission_id) VALUES(?,?)', ['admin-role', 'scope-read']);
    database.run('INSERT INTO user_roles(user_id,role_id) VALUES(?,?)', ['delegator', 'admin-role']);
    database.run('INSERT INTO node_scope_assignments(id,user_id,role_id,node_id,assignment_effect,propagation) VALUES(?,?,?,?,?,?)', ['delegator-grant', 'delegator', 'reader-role', 'root', 'allow', 'subtree']);
    const repository = new SecurityRepositorySqlite(database);
    await expect(repository.createScopeAssignment('invalid', 'inactive', 'root', 'reader-role', 'allow', 'self', 'delegator')).rejects.toBeInstanceOf(SecurityAdminValidationError);
    await repository.createScopeAssignment('delegated', 'target', 'root', 'reader-role', 'allow', 'self', 'delegator');
    const policies = await repository.listRealtimeChannelPoliciesForUser('delegator');
    expect(policies).toHaveLength(1);
    expect(policies[0]?.rules).toContainEqual({ nodeId: null, assignmentEffect: 'allow', propagation: 'global', permissionKey: 'scope.read' });
    database.run('DELETE FROM node_scope_assignments WHERE id=?', ['delegator-grant']);
    await expect(repository.revokeDelegatedScopeAssignmentsOutsideCoverage()).resolves.toEqual([expect.objectContaining({ id: 'delegated', userId: 'target', assignedBy: 'delegator' })]);
    expect(database.get('SELECT 1 FROM node_scope_assignments WHERE id=?', ['delegated'])).toBeUndefined();
    database.close();
  });
});
