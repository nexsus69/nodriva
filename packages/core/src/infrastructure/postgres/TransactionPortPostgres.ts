import pg from 'pg';
import { TransactionPort } from '../../application/ports/TransactionPort.js';
import { PgTransactionContext } from './PgTransactionContext.js';

export class TransactionPortPostgres implements TransactionPort {
  constructor(private readonly pool: pg.Pool) {}

  async runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    const existingClient = PgTransactionContext.getClient();
    if (existingClient) {
      return await work();
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await PgTransactionContext.run(client, async () => {
        return await work();
      });
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
