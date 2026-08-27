/** Provides transaction-aware PostgreSQL queries to infrastructure adapters. */
import type pg from 'pg';
import { PgTransactionContext } from './PgTransactionContext.js';

export class PgExecutor {
  constructor(private readonly pool: pg.Pool) {}

  async query<T extends pg.QueryResultRow = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ): Promise<pg.QueryResult<T>> {
    const txClient = PgTransactionContext.getClient();
    if (txClient) {
      return await txClient.query<T>(text, params);
    }
    return await this.pool.query<T>(text, params);
  }

  /** Runs a small adapter-level unit atomically, reusing an application transaction when present. */
  async runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    if (PgTransactionContext.getClient()) return await work();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await PgTransactionContext.run(client, work);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
