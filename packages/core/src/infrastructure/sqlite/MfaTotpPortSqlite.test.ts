/** Verifies SQLite parity for active and pending TOTP factor persistence. */
import { describe, expect, it } from 'vitest';
import { SqliteDatabase } from './SqliteDatabase.js';
import { ensureSqliteSchema } from './SqliteSchema.js';
import { MfaTotpPortSqlite } from './MfaTotpPortSqlite.js';

describe('MfaTotpPortSqlite', () => {
  it('replaces pending setup and consumes recovery codes once', async () => {
    const database = new SqliteDatabase(); ensureSqliteSchema(database); database.run('INSERT INTO users (id) VALUES (?)', ['user']);
    const mfa = new MfaTotpPortSqlite(database); await mfa.savePending('user', 'cipher', new Date('2026-01-01T00:10:00Z')); await mfa.promotePending('user', ['hash-1', 'hash-2'], new Date('2026-01-01T00:00:00Z'));
    await expect(mfa.consumeRecoveryCode('user', 'hash-1')).resolves.toBe(true); await expect(mfa.consumeRecoveryCode('user', 'hash-1')).resolves.toBe(false); await expect(mfa.findByUserId('user')).resolves.toMatchObject({ recoveryCodeHashes: ['hash-2'] }); database.close();
  });
});
