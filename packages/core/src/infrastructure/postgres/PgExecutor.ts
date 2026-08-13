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
}
