/** Verifies SQLite account action delivery outbox persistence semantics. */
import { describe, expect, it } from 'vitest';
import { SqliteDatabase } from './SqliteDatabase.js';
import { ensureSqliteSchema } from './SqliteSchema.js';
import { AccountActionDeliveryOutboxSqlite } from './AccountActionDeliveryOutboxSqlite.js';

describe('AccountActionDeliveryOutboxSqlite', () => {
  it('is idempotent, leases work and retains only retryable ciphertext until delivery', async () => {
    const database = new SqliteDatabase(); ensureSqliteSchema(database);
    const outbox = new AccountActionDeliveryOutboxSqlite(database);
    const item = { id: 'delivery-1', email: 'person@example.test', purpose: 'password_reset' as const, tokenCiphertext: 'not-plain-token', expiresAt: new Date(Date.now() + 60_000) };
    await outbox.enqueue(item); await outbox.enqueue(item);
    expect(database.get<{ count: number }>('SELECT COUNT(*) AS count FROM account_action_delivery_outbox')?.count).toBe(1);
    await expect(outbox.claimPending('worker-1', 1)).resolves.toEqual([item]);
    await outbox.markFailed(item.id, 'worker-1', 'mail down');
    const failed = database.get<{ attempts: number; token_ciphertext: string; locked_by: string | null }>('SELECT attempts,token_ciphertext,locked_by FROM account_action_delivery_outbox WHERE id=?', [item.id]);
    expect(failed).toEqual({ attempts: 1, token_ciphertext: 'not-plain-token', locked_by: null });
    database.run('UPDATE account_action_delivery_outbox SET next_attempt_at=? WHERE id=?', [new Date(Date.now() - 1_000).toISOString(), item.id]);
    await expect(outbox.claimPending('worker-2', 1)).resolves.toEqual([item]);
    await outbox.markDelivered(item.id, 'worker-2');
    expect(database.get<{ token_ciphertext: string; delivered_at: string }>('SELECT token_ciphertext,delivered_at FROM account_action_delivery_outbox WHERE id=?', [item.id])).toEqual(expect.objectContaining({ token_ciphertext: '', delivered_at: expect.any(String) }));
    database.close();
  });
});
