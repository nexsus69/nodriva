import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { RUNTIME_CAPABILITIES, SYSTEM_PERMISSIONS, SYSTEM_ROLES, SYSTEM_SETTINGS } from '../SystemBootstrapCatalog.js';
import { PgExecutor } from './PgExecutor.js';
import { SystemSeedPostgres } from './SystemSeedPostgres.js';
import { TransactionPortPostgres } from './TransactionPortPostgres.js';

const databaseUrl = process.env.INTEGRATION_DATABASE_ADMIN_URL;
const databaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const describeIntegration = databaseUrl && /(?:^|_)test(?:_|$)/.test(databaseName) ? describe : describe.skip;

describeIntegration('SystemSeedPostgres integration', () => {
  let pool: pg.Pool;
  let executor: PgExecutor;
  const adminEmail = 'bootstrap-contract@example.test';
  const preservedUserId = '90000000-0000-0000-0000-000000000001';
  const preservedRoleId = '90000000-0000-0000-0000-000000000002';

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: databaseUrl });
    executor = new PgExecutor(pool);
    await executor.query('DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE email=$1) OR user_id=$2', [adminEmail, preservedUserId]);
    await executor.query('DELETE FROM users WHERE email=$1 OR id=$2', [adminEmail, preservedUserId]);
    await executor.query('DELETE FROM roles WHERE id=$1', [preservedRoleId]);
  });

  afterAll(async () => {
    await executor.query('DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE email=$1) OR user_id=$2', [adminEmail, preservedUserId]);
    await executor.query('DELETE FROM users WHERE email=$1 OR id=$2', [adminEmail, preservedUserId]);
    await executor.query('DELETE FROM roles WHERE id=$1', [preservedRoleId]);
    await pool.end();
  });

  it('matches the shared catalog, preserves existing data and is idempotent', async () => {
    const seed = new SystemSeedPostgres(executor, new TransactionPortPostgres(pool), 'Seed-password-2026!', adminEmail);
    await seed.seedDatabase();
    const original = await executor.query<{ password_hash: string }>('SELECT password_hash FROM users WHERE email=$1', [adminEmail]);
    await executor.query("UPDATE system_settings SET value_text='1234' WHERE setting_key='session.idleTimeoutSeconds'");
    await executor.query("INSERT INTO users(id,email,password_hash,is_active,is_super_admin) VALUES($1,'preserved-bootstrap@example.test','custom-hash',true,false)", [preservedUserId]);
    await executor.query("INSERT INTO roles(id,role_key,name,description,is_system) VALUES($1,'preserved_bootstrap_role','Preserved bootstrap role','custom',false)", [preservedRoleId]);

    await seed.seedDatabase();

    expect(await seed.checkSeeded()).toBe(true);
    const roles = await executor.query<{ role_key: string }>('SELECT role_key FROM roles WHERE is_system=true AND role_key=ANY($1::text[])', [SYSTEM_ROLES.map((role) => role.key)]);
    const permissions = await executor.query<{ permission_key: string }>('SELECT permission_key FROM permissions WHERE permission_key=ANY($1::text[])', [SYSTEM_PERMISSIONS.map((item) => item.key)]);
    const capabilities = await executor.query<{ capability_key: string }>('SELECT capability_key FROM runtime_capabilities WHERE capability_key=ANY($1::text[])', [RUNTIME_CAPABILITIES.map((item) => item.key)]);
    const settings = await executor.query<{ setting_key: string }>('SELECT setting_key FROM system_settings WHERE setting_key=ANY($1::text[])', [SYSTEM_SETTINGS.map((item) => item.key)]);
    expect(roles.rows.map((row) => row.role_key).sort()).toEqual(SYSTEM_ROLES.map((role) => role.key).sort());
    expect(permissions.rows.map((row) => row.permission_key).sort()).toEqual(SYSTEM_PERMISSIONS.map((item) => item.key).sort());
    expect(capabilities.rows.map((row) => row.capability_key).sort()).toEqual(RUNTIME_CAPABILITIES.map((item) => item.key).sort());
    expect(settings.rows.map((row) => row.setting_key).sort()).toEqual(SYSTEM_SETTINGS.map((item) => item.key).sort());
    expect((await executor.query('SELECT 1 FROM users WHERE id=$1', [preservedUserId])).rowCount).toBe(1);
    expect((await executor.query('SELECT 1 FROM roles WHERE id=$1', [preservedRoleId])).rowCount).toBe(1);
    expect((await executor.query<{ password_hash: string }>('SELECT password_hash FROM users WHERE email=$1', [adminEmail])).rows[0]?.password_hash).toBe(original.rows[0]?.password_hash);
    expect((await executor.query<{ value_text: string }>("SELECT value_text FROM system_settings WHERE setting_key='session.idleTimeoutSeconds'")).rows[0]?.value_text).toBe('1234');
  });
});
