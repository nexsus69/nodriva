import { AsyncLocalStorage } from 'node:async_hooks';
import type { TransactionPort } from '../../application/ports/TransactionPort.js';
import type { SqliteDatabase } from './SqliteDatabase.js';

interface TransactionState {
  depth: number;
  afterCommitEffects: Array<() => void | Promise<void>>;
}

/** Transaction adapter for SQLite, including nested application service calls. */
export class TransactionPortSqlite implements TransactionPort {
  private readonly context = new AsyncLocalStorage<TransactionState>();
  private transactionTail: Promise<void> = Promise.resolve();

  constructor(private readonly database: SqliteDatabase) {}

  async runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    const existing = this.context.getStore();
    if (existing) {
      existing.depth += 1;
      try {
        return await work();
      } finally {
        existing.depth -= 1;
      }
    }

    let releaseTransaction!: () => void;
    const previousTransaction = this.transactionTail;
    this.transactionTail = new Promise<void>((resolve) => {
      releaseTransaction = resolve;
    });
    await previousTransaction;

    const state: TransactionState = { depth: 1, afterCommitEffects: [] };
    let transactionStarted = false;
    try {
      this.database.exec('BEGIN');
      transactionStarted = true;
      const result = await this.context.run(state, work);
      this.database.exec('COMMIT');
      transactionStarted = false;
      for (const effect of state.afterCommitEffects) {
        try {
          await effect();
        } catch (error: unknown) {
          console.error('[TransactionPortSqlite] afterCommit effect failed:', error);
        }
      }
      return result;
    } catch (error: unknown) {
      if (transactionStarted) this.database.exec('ROLLBACK');
      throw error;
    } finally {
      releaseTransaction();
    }
  }

  async runInAuthorizationMutation<T>(work: () => Promise<T>): Promise<T> {
    return this.runInTransaction(work);
  }

  afterCommit(effect: () => void | Promise<void>): void {
    const state = this.context.getStore();
    if (!state) {
      void Promise.resolve(effect()).catch((error: unknown) => {
        console.error('[TransactionPortSqlite] immediate afterCommit effect failed:', error);
      });
      return;
    }
    state.afterCommitEffects.push(effect);
  }
}
