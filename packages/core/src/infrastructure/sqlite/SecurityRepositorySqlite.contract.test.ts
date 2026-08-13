import { SecurityRepositorySqlite } from './SecurityRepositorySqlite.js';
import { SqliteDatabase } from './SqliteDatabase.js';
import { ensureSqliteSchema } from './SqliteSchema.js';
import { registerSecurityRepositoryContract } from '../contract/SecurityRepository.contract.js';

registerSecurityRepositoryContract('SQLite', async () => {
  const database = new SqliteDatabase();
  ensureSqliteSchema(database);
  const timestamp = '2026-01-01T00:00:00.000Z';
  database.run('INSERT INTO node_types(id,type_key,name) VALUES(?,?,?)', ['type', 'contract_acl_type', 'Contract ACL type']);
  database.run('INSERT INTO nodes(id,parent_id,path,path_label,depth,node_type_id,name,row_version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)', ['root', null, 'contract_acl_root', 'contract_acl_root', 0, 'type', 'Root', 1, timestamp, timestamp]);
  for (const userId of ['delegator', 'intermediate', 'target']) {
    database.run('INSERT INTO users(id,email,is_active,is_super_admin) VALUES(?,?,?,?)', [userId, `${userId}@contract.test`, 1, 0]);
  }
  database.run('INSERT INTO roles(id,role_key,name) VALUES(?,?,?)', ['reader', 'contract_acl_reader', 'Contract ACL reader']);
  database.run('INSERT INTO permissions(id,permission_key,name) VALUES(?,?,?)', ['node-read', 'node.read', 'Node read']);
  database.run('INSERT INTO role_permissions(role_id,permission_id) VALUES(?,?)', ['reader', 'node-read']);
  database.run('INSERT INTO node_scope_assignments(id,user_id,node_id,role_id,assignment_effect,propagation) VALUES(?,?,?,?,?,?)', ['delegator-coverage', 'delegator', 'root', 'reader', 'allow', 'subtree']);
  return {
    repository: new SecurityRepositorySqlite(database),
    ids: { delegator: 'delegator', intermediate: 'intermediate', target: 'target', root: 'root', reader: 'reader', firstDelegation: 'delegated-first', secondDelegation: 'delegated-second', contradictoryDeny: 'contradictory-deny' },
    removeDelegatorCoverage: async () => { database.run('DELETE FROM node_scope_assignments WHERE id=?', ['delegator-coverage']); },
    hasAssignment: async (id) => Boolean(database.get('SELECT 1 FROM node_scope_assignments WHERE id=?', [id])),
    dispose: async () => { database.close(); },
  };
});
