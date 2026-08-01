import pg from 'pg';
import { AsyncLocalStorage } from 'async_hooks';

export class PgTransactionContext {
  private static storage = new AsyncLocalStorage<pg.PoolClient>();

  static run<T>(client: pg.PoolClient, work: () => Promise<T>): Promise<T> {
    return this.storage.run(client, work);
  }

  static getClient(): pg.PoolClient | null {
    return this.storage.getStore() ?? null;
  }
}
