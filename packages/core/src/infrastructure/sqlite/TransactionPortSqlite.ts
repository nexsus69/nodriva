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

    const state: TransactionState = { depth: 1, afterCommitEffects: [] };
    this.database.exec('BEGIN');
    try {
      const result = await this.context.run(state, work);
      this.database.exec('COMMIT');
      for (const effect of state.afterCommitEffects) {
        try {
          await effect();
        } catch (error: unknown) {
          console.error('[TransactionPortSqlite] afterCommit effect failed:', error);
        }
      }
      return result;
    } catch (error: unknown) {
      this.database.exec('ROLLBACK');
      throw error;
    }
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
