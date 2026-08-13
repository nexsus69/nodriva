import { describe, expect, it } from 'vitest';
import { SqliteDatabase } from './SqliteDatabase.js';
import { ensureSqliteSchema } from './SqliteSchema.js';
import { SystemSeedSqlite } from './SystemSeedSqlite.js';
import { RuntimeConfigurationPortSqlite } from './RuntimeConfigurationPortSqlite.js';

describe('SystemSeedSqlite', () => {
  it('seeds the session inactivity timeout at thirty minutes', async () => {
    const database = new SqliteDatabase();
    ensureSqliteSchema(database);

    await new SystemSeedSqlite(database, 'Seed-password-2026!').seedDatabase();

    await expect(
      new RuntimeConfigurationPortSqlite(database).getSetting('session.idleTimeoutSeconds', 0),
    ).resolves.toBe(1800);
    database.close();
  });
});
