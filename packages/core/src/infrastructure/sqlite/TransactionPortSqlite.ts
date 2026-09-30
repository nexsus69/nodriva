import { AsyncLocalStorage } from 'node:async_hooks';
import type { TransactionPort } from '../../application/ports/TransactionPort.js';
import type { SqliteDatabase } from './SqliteDatabase.js';

interface TransactionState {
  depth: number;
  active: boolean;
  afterCommitEffects: Array<() => void | Promise<void>>;
}

/** Transaction adapter for SQLite, including nested application service calls. */
export class TransactionPortSqlite implements TransactionPort {
  private readonly context = new AsyncLocalStorage<TransactionState>();

  constructor(private readonly database: SqliteDatabase) {}

  async runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    const existing = this.context.getStore();
    if (existing?.active) {
      existing.depth += 1;
      try {
        return await work();
      } finally {
        existing.depth -= 1;
      }
    }

    const state: TransactionState = { depth: 1, active: true, afterCommitEffects: [] };
    const result = await this.database.exclusive(async () => {
      let transactionStarted = false;
      try {
        this.database.exec('BEGIN IMMEDIATE');
        transactionStarted = true;
        const result = await this.context.run(state, work);
        this.database.exec('COMMIT');
        transactionStarted = false;
        return result;
      } catch (error: unknown) {
        if (transactionStarted) this.database.exec('ROLLBACK');
        throw error;
      } finally {
        state.active = false;
      }
    });
    for (const effect of state.afterCommitEffects) {
      try { await effect(); }
      catch (error: unknown) { console.error('[TransactionPortSqlite] afterCommit effect failed:', error); }
    }
    return result;
  }

  async runInAuthorizationMutation<T>(work: () => Promise<T>): Promise<T> {
    if (this.context.getStore()?.active) throw new Error('Authorization-policy mutations must own the outermost transaction.');
    return this.runInTransaction(work);
  }

  afterCommit(effect: () => void | Promise<void>): void {
    const state = this.context.getStore();
    if (!state?.active) {
      void Promise.resolve(effect()).catch((error: unknown) => {
        console.error('[TransactionPortSqlite] immediate afterCommit effect failed:', error);
      });
      return;
    }
    state.afterCommitEffects.push(effect);
  }
}
