import { describe, expect, it } from 'vitest';
import { SqliteDatabase } from './SqliteDatabase.js';
import { ensureSqliteSchema } from './SqliteSchema.js';
import { SessionRepositorySqlite } from './SessionRepositorySqlite.js';
import { LoginRateLimitPortSqlite } from './LoginRateLimitPortSqlite.js';
import { AccountActionTokenPortSqlite } from './AccountActionTokenPortSqlite.js';

describe('SQLite session and security adapters', () => {
  it('handles session lifecycle and single-use action tokens', async () => {
    const database = new SqliteDatabase(); ensureSqliteSchema(database);
    database.run('INSERT INTO users (id) VALUES (?)', ['user']);
    const now = new Date('2026-01-01T00:00:00Z');
    const sessions = new SessionRepositorySqlite(database, () => now);
    const sessionId = await sessions.createSession('user', 'token', new Date('2026-01-01T01:00:00Z'));
    expect(sessionId).toHaveLength(36);
    await expect(sessions.getSessionUserId('token')).resolves.toBe('user');
    await sessions.deleteSession('token');
    await expect(sessions.getSessionUserId('token')).resolves.toBeNull();
    const tokens = new AccountActionTokenPortSqlite(database);
    await tokens.create({ userId: 'user', purpose: 'password_reset', tokenHash: 'hash', expiresAt: new Date('2026-01-01T01:00:00Z'), createdBy: 'user' });
    await expect(tokens.consume('hash', now)).resolves.toEqual({ userId: 'user', purpose: 'password_reset' });
    await expect(tokens.consume('hash', now)).resolves.toBeNull();
    database.close();
  });

  it('blocks after five failures and resets after the window', async () => {
    const database = new SqliteDatabase(); ensureSqliteSchema(database);
    const rate = new LoginRateLimitPortSqlite(database);
    const now = new Date('2026-01-01T00:00:00Z');
    for (let index = 0; index < 5; index += 1) await rate.recordFailure('subject', now);
    await expect(rate.assertAllowed('subject', now)).rejects.toThrow('Invalid credentials');
    await expect(rate.assertAllowed('subject', new Date('2026-01-01T00:16:00Z'))).resolves.toBeUndefined();
    database.close();
  });
});
