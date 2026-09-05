/** Verifies PostgreSQL batch resource visibility uses read ACL and deny precedence. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { AccessControlPortPostgres } from './AccessControlPortPostgres.js';
import { PgExecutor } from './PgExecutor.js';

const url = process.env.INTEGRATION_DATABASE_URL;
const database = url ? new URL(url).pathname.slice(1) : '';
const integration = url && /(?:^|_)test(?:_|$)/.test(database) ? describe : describe.skip;
const id = {
  type: '71000000-0000-0000-0000-000000000001',
  root: '71000000-0000-0000-0000-000000000002',
  child: '71000000-0000-0000-0000-000000000003',
  user: '71000000-0000-0000-0000-000000000004',
  role: '71000000-0000-0000-0000-000000000005',
  misleadingUser: '71000000-0000-0000-0000-000000000006',
  misleadingRole: '71000000-0000-0000-0000-000000000007',
  misleadingPermission: '71000000-0000-0000-0000-000000000008',
};

integration('AccessControlPortPostgres batch visibility', () => {
  let pool: pg.Pool; let acl: AccessControlPortPostgres;
  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url }); const executor = new PgExecutor(pool); acl = new AccessControlPortPostgres(executor);
    await executor.query('DELETE FROM node_scope_assignments WHERE user_id=$1', [id.user]);
    await executor.query('DELETE FROM nodes WHERE id=ANY($1::uuid[])', [[id.root, id.child]]);
    await executor.query('DELETE FROM users WHERE id=$1', [id.user]); await executor.query('DELETE FROM roles WHERE id=$1', [id.role]); await executor.query('DELETE FROM node_types WHERE id=$1', [id.type]);
    await executor.query("INSERT INTO node_types(id,type_key,name) VALUES($1,'f02_acl','F02 ACL')", [id.type]);
    await executor.query("INSERT INTO nodes(id,path,path_label,depth,node_type_id,name,row_version) VALUES($1,'f02_root'::ltree,'f02_root',0,$3,'root',1),($2,'f02_root.child'::ltree,'child',1,$3,'child',1)", [id.root, id.child, id.type]);
    await executor.query("INSERT INTO users(id,email,password_hash,is_active,is_super_admin) VALUES($1,'f02-reader@contract.test','x',true,false)", [id.user]);
    await executor.query("INSERT INTO roles(id,role_key,name) VALUES($1,'f02_reader','F02 reader')", [id.role]);
    const permission = await executor.query<{ id: string }>("SELECT id FROM permissions WHERE permission_key='node.read'");
    await executor.query('INSERT INTO role_permissions(role_id,permission_id) VALUES($1,$2)', [id.role, permission.rows[0]!.id]); await executor.query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [id.user, id.role]);
    await executor.query("INSERT INTO node_scope_assignments(id,user_id,node_id,role_id,assignment_effect,propagation) VALUES(gen_random_uuid(),$1,$2,$3,'allow','subtree'),(gen_random_uuid(),$1,$4,$3,'deny','self')", [id.user, id.root, id.role, id.child]);
    await executor.query('DELETE FROM node_scope_assignments WHERE user_id=$1', [id.misleadingUser]);
    await executor.query('DELETE FROM user_roles WHERE user_id=$1', [id.misleadingUser]);
    await executor.query('DELETE FROM role_permissions WHERE role_id=$1 OR permission_id=$2', [id.misleadingRole, id.misleadingPermission]);
    await executor.query('DELETE FROM users WHERE id=$1', [id.misleadingUser]);
    await executor.query('DELETE FROM roles WHERE id=$1', [id.misleadingRole]);
    await executor.query('DELETE FROM permissions WHERE id=$1', [id.misleadingPermission]);
    await executor.query("INSERT INTO users(id,email,password_hash,is_active,is_super_admin) VALUES($1,'f06-name-collision@contract.test','x',true,false)", [id.misleadingUser]);
    await executor.query("INSERT INTO roles(id,role_key,name) VALUES($1,'f06_misleading_reader','F06 misleading reader')", [id.misleadingRole]);
    await executor.query("INSERT INTO permissions(id,permission_key,name,description,resource_kind) VALUES($1,'custom.not-node-read','node.read','Display name intentionally collides with node.read','node')", [id.misleadingPermission]);
    await executor.query('INSERT INTO role_permissions(role_id,permission_id) VALUES($1,$2)', [id.misleadingRole, id.misleadingPermission]);
    await executor.query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [id.misleadingUser, id.misleadingRole]);
    await executor.query("INSERT INTO node_scope_assignments(id,user_id,node_id,role_id,assignment_effect,propagation) VALUES(gen_random_uuid(),$1,$2,$3,'allow','subtree')", [id.misleadingUser, id.root, id.misleadingRole]);
  });
  afterAll(async () => { await pool?.end(); });
  it('returns only the allowed active targets in one batch', async () => {
    await expect(acl.listReadableResourceIds(id.user, 'node', [id.child, id.root])).resolves.toEqual([id.root]);
  });

  it('does not treat permission display names as technical permission keys', async () => {
    await expect(acl.assertCanReadNode(id.misleadingUser, id.root)).rejects.toMatchObject({
      code: 'ACCESS_FORBIDDEN',
    });
  });
});
