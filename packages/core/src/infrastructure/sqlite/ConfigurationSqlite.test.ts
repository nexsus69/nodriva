import { describe, expect, it } from 'vitest';
import { SqliteDatabase } from './SqliteDatabase.js';
import { ensureSqliteSchema } from './SqliteSchema.js';
import { ConfigurationRepositorySqlite } from './ConfigurationRepositorySqlite.js';
import { RuntimeConfigurationPortSqlite } from './RuntimeConfigurationPortSqlite.js';

describe('SQLite configuration adapters', () => {
  it('preserve types, capability overrides and optimistic versions', async () => {
    const database = new SqliteDatabase(); ensureSqliteSchema(database);
    database.run('INSERT INTO system_settings (setting_key,value_type,value_text,row_version) VALUES (?,?,?,?)', ['flag', 'boolean', 'false', 1]);
    database.run('INSERT INTO runtime_capabilities VALUES (?,?)', ['realtime', 'disabled']);
    database.run('INSERT INTO runtime_capability_overrides VALUES (?,?,?)', ['realtime', 'single-user', 'enabled']);
    const repository = new ConfigurationRepositorySqlite(database);
    await expect(repository.get('flag')).resolves.toMatchObject({ value: false, version: 1 });
    await expect(repository.set('flag', true, 1)).resolves.toMatchObject({ value: true, version: 2 });
    await expect(new RuntimeConfigurationPortSqlite(database).isCapabilityEnabled('realtime')).resolves.toBe(true);
    await expect(new RuntimeConfigurationPortSqlite(database).getSetting('missing', 42)).resolves.toBe(42);
    database.close();
  });
});
