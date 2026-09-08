/** Verifies shared and exclusive PostgreSQL authorization-policy locking. */
import type pg from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { PgTransactionContext } from './PgTransactionContext.js';
import { TransactionPortPostgres } from './TransactionPortPostgres.js';

function createContext() {
  const client = {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: vi.fn(),
  } as unknown as pg.PoolClient;
  const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as pg.Pool;
  return { client, transactions: new TransactionPortPostgres(pool) };
}

describe('TransactionPortPostgres authorization policy lock', () => {
  it('takes a shared policy lock for protected ordinary transactions', async () => {
    const { client, transactions } = createContext();
    await expect(transactions.runInTransaction(async () => 'done')).resolves.toBe('done');
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      'SELECT pg_advisory_xact_lock_shared($1)',
      [1_845_102_820],
    );
  });

  it('takes the exclusive lock for an outermost authorization mutation', async () => {
    const { client, transactions } = createContext();
    await transactions.runInAuthorizationMutation(async () => undefined);
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      'SELECT pg_advisory_xact_lock($1)',
      [1_845_102_820],
    );
  });

  it('rejects a nested authorization mutation instead of silently losing serialization', async () => {
    const { client, transactions } = createContext();
    await expect(PgTransactionContext.run(client, () => transactions.runInAuthorizationMutation(async () => undefined)))
      .rejects.toThrow('must own the outermost transaction');
  });
});
