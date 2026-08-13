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
  private savepointSequence = 0;

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

  /** Executes synchronous work atomically, including when the caller already has a transaction open. */
  transaction<T>(work: () => T): T {
    const savepoint = `sqlite_adapter_${this.savepointSequence += 1}`;
    this.database.exec(`SAVEPOINT ${savepoint}`);
    try {
      const result = work();
      this.database.exec(`RELEASE SAVEPOINT ${savepoint}`);
      return result;
    } catch (error: unknown) {
      this.database.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      this.database.exec(`RELEASE SAVEPOINT ${savepoint}`);
      throw error;
    }
  }

  get<T extends object = Record<string, unknown>>(
    sql: string,
    parameters: readonly unknown[] = [],
  ): T | undefined {
    const row = this.database.prepare(sql).get(...parameters) as T | undefined;
    return row ? { ...row } : undefined;
  }

  all<T extends object = Record<string, unknown>>(
    sql: string,
    parameters: readonly unknown[] = [],
  ): T[] {
    const rows = this.database.prepare(sql).all(...parameters) as T[];
    return rows.map((row) => ({ ...row }));
  }

  hasColumn(tableName: string, columnName: string): boolean {
    const supportedTables = new Set(['node_types', 'entity_types', 'node_type_fields', 'entity_type_fields']);
    if (!supportedTables.has(tableName)) {
      throw new Error(`Unsupported SQLite schema table '${tableName}'.`);
    }
    const columns = this.all<{ name: string }>(`PRAGMA table_info(${tableName})`);
    return columns.some((column) => column.name === columnName);
  }

  close(): void {
    this.database.close();
  }
}
