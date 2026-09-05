/** Verifies the SQLite composition root wires shared infrastructure policies consistently. */
import { describe, expect, it } from 'vitest';
import { SqliteInfrastructure } from './SqliteInfrastructure.js';
import { FieldEncryptionServiceSqlite } from './FieldEncryptionServiceSqlite.js';
import { Entity } from '../../domain/models/Entity.js';

describe('SqliteInfrastructure', () => {
  it('initializes one coherent standalone composition root', () => {
    const infrastructure = new SqliteInfrastructure();
    expect(infrastructure.nodeRepository).toBeDefined();
    expect(infrastructure.accessControlPort).toBeDefined();
    expect(infrastructure.userRepository).toBeDefined();
    expect(infrastructure.database.get('SELECT 1 AS ready')).toEqual({ ready: 1 });
    infrastructure.close();
  });

  it('normalizes driver rows to plain objects at the adapter boundary', () => {
    const infrastructure = new SqliteInfrastructure();
    const row = infrastructure.database.get<{ value: number }>('SELECT 1 AS value');
    const rows = infrastructure.database.all<{ value: number }>('SELECT 1 AS value UNION ALL SELECT 2 AS value');

    expect(Object.getPrototypeOf(row)).toBe(Object.prototype);
    expect(rows.map((item) => Object.getPrototypeOf(item))).toEqual([
      Object.prototype,
      Object.prototype,
    ]);
    infrastructure.close();
  });

  it('bootstraps a fresh standalone database when administrator credentials are configured', async () => {
    const previousPassword = process.env.SEED_ADMIN_PASSWORD;
    const previousEmail = process.env.SEED_ADMIN_EMAIL;
    process.env.SEED_ADMIN_PASSWORD = 'Standalone-bootstrap-2026!';
    process.env.SEED_ADMIN_EMAIL = 'standalone@example.test';
    try {
      const infrastructure = new SqliteInfrastructure();
      expect(infrastructure.database.get("SELECT 1 FROM users WHERE email='standalone@example.test' AND is_super_admin=1")).toBeTruthy();
      await expect(infrastructure.systemSeedService.checkSeeded()).resolves.toBe(true);
      infrastructure.close();
    } finally {
      if (previousPassword === undefined) delete process.env.SEED_ADMIN_PASSWORD;
      else process.env.SEED_ADMIN_PASSWORD = previousPassword;
      if (previousEmail === undefined) delete process.env.SEED_ADMIN_EMAIL;
      else process.env.SEED_ADMIN_EMAIL = previousEmail;
    }
  });

  it('wires field encryption into SQLite repositories after runtime config is available', async () => {
    const infrastructure = new SqliteInfrastructure();
    const enabledConfig = { get: async () => true };
    infrastructure.configureFieldEncryption(new FieldEncryptionServiceSqlite(infrastructure.database, enabledConfig as never, '11'.repeat(32)));
    const now = new Date('2026-01-01T00:00:00.000Z');
    infrastructure.database.run('INSERT INTO node_types (id,type_key,name) VALUES (?,?,?)', ['node-type', 'folder', 'Folder']);
    infrastructure.database.run('INSERT INTO nodes (id,path,path_label,depth,node_type_id,name,created_at,updated_at,row_version,payload) VALUES (?,?,?,?,?,?,?,?,?,?)', ['node-1', 'node_1', 'node_1', 0, 'node-type', 'Node', now.toISOString(), now.toISOString(), 1, '{}']);
    infrastructure.database.run('INSERT INTO entity_types (id,type_key,name,storage_table) VALUES (?,?,?,?)', ['entity-type', 'record', 'Record', 'entity_record']);
    infrastructure.database.run('INSERT INTO entity_type_fields (id,entity_type_id,field_key,column_name,data_type,encryption_mode) VALUES (?,?,?,?,?,?)', ['secret-field', 'entity-type', 'secret', 'secret', 'string', 'encrypted']);

    await infrastructure.entityRepository.create(new Entity('entity-1', 'entity-type', 'node-1', 'Entity', '', 1, now, now, null, 'user', 'user', { secret: 'stored-secret' }));

    expect(infrastructure.database.get<{ payload: string }>('SELECT payload FROM entities WHERE id=?', ['entity-1'])?.payload).toContain('"secret":null');
    await expect(infrastructure.entityRepository.findById('entity-1')).resolves.toMatchObject({ payload: { secret: 'stored-secret' } });
    infrastructure.close();
  });
});
