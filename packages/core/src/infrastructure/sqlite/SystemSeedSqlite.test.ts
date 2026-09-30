/** Verifies idempotent SQLite bootstrap and its required administrator identity. */
import { describe, expect, it } from 'vitest';
import { RUNTIME_CAPABILITIES, SYSTEM_PERMISSIONS, SYSTEM_ROLES, SYSTEM_SETTINGS } from '../SystemBootstrapCatalog.js';
import { SqliteDatabase } from './SqliteDatabase.js';
import { ensureSqliteSchema } from './SqliteSchema.js';
import { SystemSeedSqlite } from './SystemSeedSqlite.js';
import { RuntimeConfigurationPortSqlite } from './RuntimeConfigurationPortSqlite.js';
import { SqliteInfrastructure } from './SqliteInfrastructure.js';

describe('SystemSeedSqlite', () => {
  it('does not attempt implicit bootstrap with incomplete deployment credentials', () => {
    const password = process.env.SEED_ADMIN_PASSWORD;
    const email = process.env.SEED_ADMIN_EMAIL;
    process.env.SEED_ADMIN_PASSWORD = 'Test-password-2026!';
    delete process.env.SEED_ADMIN_EMAIL;
    try {
      const infrastructure = new SqliteInfrastructure();
      expect(infrastructure.database.get('SELECT 1 FROM users')).toBeUndefined();
      infrastructure.close();
    } finally {
      if (password === undefined) delete process.env.SEED_ADMIN_PASSWORD; else process.env.SEED_ADMIN_PASSWORD = password;
      if (email === undefined) delete process.env.SEED_ADMIN_EMAIL; else process.env.SEED_ADMIN_EMAIL = email;
    }
  });
  it('requires an explicit administrator email', async () => {
    const database = new SqliteDatabase();
    ensureSqliteSchema(database);

    await expect(new SystemSeedSqlite(database, 'Seed-password-2026!').seedDatabase())
      .rejects.toThrow('SEED_ADMIN_EMAIL must be configured');
    expect(database.get('SELECT 1 FROM users LIMIT 1')).toBeUndefined();
    database.close();
  });

  it('creates the shared administrative bootstrap and is idempotent', async () => {
    const database = new SqliteDatabase();
    ensureSqliteSchema(database);
    const seed = new SystemSeedSqlite(database, 'Seed-password-2026!', 'bootstrap@example.test');

    await seed.seedDatabase();
    const originalHash = database.get<{ password_hash: string }>("SELECT password_hash FROM users WHERE email='bootstrap@example.test'")!.password_hash;
    database.run("UPDATE system_settings SET value_text='1234' WHERE setting_key='session.idleTimeoutSeconds'");
    database.run("INSERT INTO users(id,email,password_hash,is_active,is_super_admin) VALUES('preserved-user','preserved@example.test','custom-hash',1,0)");
    database.run("INSERT INTO roles(id,role_key,name,description,is_system) VALUES('preserved-role','preserved_role','Preserved role','custom',0)");

    await seed.seedDatabase();

    expect(await seed.checkSeeded()).toBe(true);
    expect(database.all<{ role_key: string }>('SELECT role_key FROM roles WHERE is_system=1').map((row) => row.role_key).sort())
      .toEqual(SYSTEM_ROLES.map((role) => role.key).sort());
    expect(database.all<{ permission_key: string }>('SELECT permission_key FROM permissions').map((row) => row.permission_key).sort())
      .toEqual(SYSTEM_PERMISSIONS.map((item) => item.key).sort());
    expect(database.all<{ capability_key: string }>('SELECT capability_key FROM runtime_capabilities').map((row) => row.capability_key).sort())
      .toEqual(RUNTIME_CAPABILITIES.map((item) => item.key).sort());
    expect(database.all<{ setting_key: string }>('SELECT setting_key FROM system_settings').map((row) => row.setting_key).sort())
      .toEqual(SYSTEM_SETTINGS.map((item) => item.key).sort());
    expect(database.get("SELECT 1 FROM users WHERE id='preserved-user'")).toBeTruthy();
    expect(database.get("SELECT 1 FROM roles WHERE id='preserved-role'")).toBeTruthy();
    expect(database.get<{ password_hash: string }>("SELECT password_hash FROM users WHERE email='bootstrap@example.test'")?.password_hash).toBe(originalHash);
    await expect(new RuntimeConfigurationPortSqlite(database).getSetting('session.idleTimeoutSeconds', 0)).resolves.toBe(1234);
    database.close();
  });

  it('uses a new id when the canonical administrator id already belongs to another account', async () => {
    const database = new SqliteDatabase();
    ensureSqliteSchema(database);
    database.run(
      'INSERT INTO users(id,email,password_hash,is_active,is_super_admin) VALUES(?,?,?,?,?)',
      ['00000000-0000-0000-0000-000000000001', 'existing@example.test', 'existing-hash', 1, 0],
    );
    await new SystemSeedSqlite(database, 'Seed-password-2026!', 'bootstrap@example.test').seedDatabase();
    expect(database.get<{ id: string }>("SELECT id FROM users WHERE email='existing@example.test'")?.id)
      .toBe('00000000-0000-0000-0000-000000000001');
    expect(database.get<{ id: string }>("SELECT id FROM users WHERE email='bootstrap@example.test'")?.id)
      .not.toBe('00000000-0000-0000-0000-000000000001');
    database.close();
  });
});
