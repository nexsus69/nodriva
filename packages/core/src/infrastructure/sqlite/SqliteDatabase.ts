import { createRequire } from 'node:module';

interface DatabaseSyncLike {
  exec(sql: string): void;
  prepare(sql: string): {
    all(...parameters: unknown[]): unknown[];
    get(...parameters: unknown[]): unknown;
    run(...parameters: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  };
  close(): void;
}

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (location: string) => DatabaseSyncLike };

export interface SqliteRunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

/** Small server-only wrapper around Node's built-in SQLite driver. */
export class SqliteDatabase {
  private readonly database: DatabaseSyncLike;

  constructor(location: string = ':memory:') {
    this.database = new DatabaseSync(location);
    // Next.js may create several server workers during build/startup. WAL plus
    // a bounded busy timeout prevents harmless schema/bootstrap races from
    // surfacing as SQLITE_BUSY while preserving transactional locking.
    this.database.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 10000; PRAGMA journal_mode = WAL;');
  }

  exec(sql: string): void {
    this.database.exec(sql);
  }

  run(sql: string, parameters: readonly unknown[] = []): SqliteRunResult {
    const result = this.database.prepare(sql).run(...parameters);
    return {
      changes: Number(result.changes),
      lastInsertRowid: result.lastInsertRowid,
    };
  }

  get<T extends object = Record<string, unknown>>(
    sql: string,
    parameters: readonly unknown[] = [],
  ): T | undefined {
    return this.database.prepare(sql).get(...parameters) as T | undefined;
  }

  all<T extends object = Record<string, unknown>>(
    sql: string,
    parameters: readonly unknown[] = [],
  ): T[] {
    return this.database.prepare(sql).all(...parameters) as T[];
  }

  close(): void {
    this.database.close();
  }
}
