/** Provides PostgreSQL transactions with authorization-policy serialization. */
import type pg from 'pg';
import type { TransactionPort } from '../../application/ports/TransactionPort.js';
import { PgTransactionContext } from './PgTransactionContext.js';

export class TransactionPortPostgres implements TransactionPort {
  private static readonly AUTHORIZATION_POLICY_LOCK = 1_845_102_820;
  private readonly afterCommitEffects = new WeakMap<pg.PoolClient, Array<() => void | Promise<void>>>();

  constructor(private readonly pool: pg.Pool) {}

  async runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    return this.run(work, false);
  }

  async runInAuthorizationMutation<T>(work: () => Promise<T>): Promise<T> {
    return this.run(work, true);
  }

  private async run<T>(work: () => Promise<T>, authorizationMutation: boolean): Promise<T> {
    const existingClient = PgTransactionContext.getClient();
    if (existingClient) {
      if (authorizationMutation) {
        throw new Error('Authorization-policy mutations must own the outermost transaction.');
      }
      return await work();
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        authorizationMutation ? 'SELECT pg_advisory_xact_lock($1)' : 'SELECT pg_advisory_xact_lock_shared($1)',
        [TransactionPortPostgres.AUTHORIZATION_POLICY_LOCK],
      );
      this.afterCommitEffects.set(client, []);
      const result = await PgTransactionContext.run(client, async () => {
        return await work();
      });
      await client.query('COMMIT');
      const effects = this.afterCommitEffects.get(client) ?? [];
      this.afterCommitEffects.delete(client);
      for (const effect of effects) {
        try {
          await effect();
        } catch (error) {
          // The transaction is already durable. A failed side effect must not
          // make callers believe the business operation was rolled back.
          console.error('[TransactionPortPostgres] afterCommit effect failed:', error);
        }
      }
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      this.afterCommitEffects.delete(client);
      throw error;
    } finally {
      client.release();
    }
  }

  afterCommit(effect: () => void | Promise<void>): void {
    const client = PgTransactionContext.getClient();
    if (!client) {
      void Promise.resolve(effect()).catch((error) => {
        console.error('[TransactionPortPostgres] immediate afterCommit effect failed:', error);
      });
      return;
    }
    const effects = this.afterCommitEffects.get(client) ?? [];
    effects.push(effect);
    this.afterCommitEffects.set(client, effects);
  }
}
