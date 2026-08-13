import pg from 'pg';
import { describe } from 'vitest';
import { PgExecutor } from './PgExecutor.js';
import { SecurityRepositoryPostgres } from './SecurityRepositoryPostgres.js';
import { registerSecurityRepositoryContract } from '../contract/SecurityRepository.contract.js';

const databaseUrl = process.env.INTEGRATION_DATABASE_URL;
const databaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const describeIntegration = databaseUrl && /(?:^|_)test(?:_|$)/.test(databaseName) ? describe : describe.skip;
const ids = {
  type: '20000000-0000-0000-0000-000000000001', root: '20000000-0000-0000-0000-000000000002',
  delegator: '20000000-0000-0000-0000-000000000003', intermediate: '20000000-0000-0000-0000-000000000004', target: '20000000-0000-0000-0000-000000000005',
  role: '20000000-0000-0000-0000-000000000006',
  firstDelegation: '20000000-0000-0000-0000-000000000009', secondDelegation: '20000000-0000-0000-0000-000000000010', contradictoryDeny: '20000000-0000-0000-0000-000000000011',
};

describeIntegration('PostgreSQL contract tests', () => {
  registerSecurityRepositoryContract('PostgreSQL', async () => {
    const pool = new pg.Pool({ connectionString: databaseUrl });
    const executor = new PgExecutor(pool);
    await executor.query('DELETE FROM nodes WHERE id = $1', [ids.root]);
    await executor.query('DELETE FROM node_types WHERE id = $1', [ids.type]);
    await executor.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [[ids.delegator, ids.intermediate, ids.target]]);
    await executor.query('DELETE FROM roles WHERE id = $1', [ids.role]);
    await executor.query("INSERT INTO node_types(id,type_key,name) VALUES($1,'contract_acl_type','Contract ACL type')", [ids.type]);
    await executor.query("INSERT INTO nodes(id,parent_id,path,path_label,depth,node_type_id,name,row_version) VALUES($1,NULL,'contract_acl_root'::ltree,'contract_acl_root',0,$2,'Root',1)", [ids.root, ids.type]);
    for (const [id, email] of [[ids.delegator, 'delegator'], [ids.intermediate, 'intermediate'], [ids.target, 'target']] as const) {
      await executor.query('INSERT INTO users(id,email,password_hash,is_active,is_super_admin) VALUES($1,$2,$3,true,false)', [id, `${email}@contract.test`, 'not-used']);
    }
    await executor.query("INSERT INTO roles(id,role_key,name) VALUES($1,'contract_acl_reader','Contract ACL reader')", [ids.role]);
    const nodeRead = await executor.query<{ id: string }>("SELECT id FROM permissions WHERE permission_key = 'node.read'");
    const nodeReadId = nodeRead.rows[0]?.id;
    if (!nodeReadId) throw new Error('The integration schema must provide the node.read permission.');
    await executor.query('INSERT INTO role_permissions(role_id,permission_id) VALUES($1,$2)', [ids.role, nodeReadId]);
    await executor.query("INSERT INTO node_scope_assignments(id,user_id,node_id,role_id,assignment_effect,propagation) VALUES('20000000-0000-0000-0000-000000000008',$1,$2,$3,'allow','subtree')", [ids.delegator, ids.root, ids.role]);
    return {
      repository: new SecurityRepositoryPostgres(executor),
      ids: { delegator: ids.delegator, intermediate: ids.intermediate, target: ids.target, root: ids.root, reader: ids.role, firstDelegation: ids.firstDelegation, secondDelegation: ids.secondDelegation, contradictoryDeny: ids.contradictoryDeny },
      removeDelegatorCoverage: async () => { await executor.query("DELETE FROM node_scope_assignments WHERE id='20000000-0000-0000-0000-000000000008'"); },
      hasAssignment: async (id) => (await executor.query('SELECT 1 FROM node_scope_assignments WHERE id = $1', [id])).rows.length > 0,
      dispose: async () => {
        await executor.query('DELETE FROM nodes WHERE id = $1', [ids.root]);
        await executor.query('DELETE FROM node_types WHERE id = $1', [ids.type]);
        await executor.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [[ids.delegator, ids.intermediate, ids.target]]);
        await executor.query('DELETE FROM roles WHERE id = $1', [ids.role]);
        await pool.end();
      },
    };
  });
});
