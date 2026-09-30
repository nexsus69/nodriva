/** Owns SQLite connection access, including asynchronous adapter isolation. */
import { createRequire } from 'node:module';
import { AsyncLocalStorage } from 'node:async_hooks';

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
  private readonly ownership = new AsyncLocalStorage<{ active: boolean }>();
  private owner: { active: boolean } | undefined;
  private tail: Promise<void> = Promise.resolve();

  /** Serializes independent operations while preserving nested adapter calls. */
  async exclusive<T>(work: () => Promise<T>): Promise<T> {
    const context = this.ownership.getStore();
    if (context?.active && context === this.owner) return work();
    let release!: () => void;
    const previous = this.tail;
    this.tail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    const owner = { active: true };
    this.owner = owner;
    try {
      return await this.ownership.run(owner, work);
    } finally {
      owner.active = false;
      this.owner = undefined;
      release();
    }
  }

  /** Native async port implementations share this connection's gate; sync helpers stay synchronous. */
  protectAsyncMethods(adapter: object): void {
    const prototype = Object.getPrototypeOf(adapter) as object;
    for (const name of Object.getOwnPropertyNames(prototype)) {
      const method: unknown = Reflect.get(prototype, name);
      if (typeof method !== 'function' || method.constructor.name !== 'AsyncFunction') continue;
      Object.defineProperty(adapter, name, {
        configurable: true,
        value: (...args: unknown[]) => this.exclusive(() => Reflect.apply(method, adapter, args) as Promise<unknown>),
      });
    }
  }

  private assertOwnership(): void {
    const context = this.ownership.getStore();
    if ((this.owner && context !== this.owner) || (context && !context.active)) {
      throw new Error('SQLite connection access requires its active asynchronous owner.');
    }
  }

  constructor(location: string = ':memory:') {
    this.database = new DatabaseSync(location);
    // Next.js may create several server workers during build/startup. WAL plus
    // a bounded busy timeout prevents harmless schema/bootstrap races from
    // surfacing as SQLITE_BUSY while preserving transactional locking.
    this.database.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 10000; PRAGMA journal_mode = WAL;');
  }

  exec(sql: string): void {
    this.assertOwnership();
    this.database.exec(sql);
  }

  run(sql: string, parameters: readonly unknown[] = []): SqliteRunResult {
    this.assertOwnership();
    const result = this.database.prepare(sql).run(...parameters);
    return {
      changes: Number(result.changes),
      lastInsertRowid: result.lastInsertRowid,
    };
  }

  /** Executes synchronous work atomically, including when the caller already has a transaction open. */
  transaction<T>(work: () => T): T {
    this.assertOwnership();
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
    this.assertOwnership();
    const row = this.database.prepare(sql).get(...parameters) as T | undefined;
    return row ? { ...row } : undefined;
  }

  all<T extends object = Record<string, unknown>>(
    sql: string,
    parameters: readonly unknown[] = [],
  ): T[] {
    this.assertOwnership();
    const rows = this.database.prepare(sql).all(...parameters) as T[];
    return rows.map((row) => ({ ...row }));
  }

  hasColumn(tableName: string, columnName: string): boolean {
    const supportedTables = new Set(['node_types', 'entity_types', 'node_type_fields', 'entity_type_fields', 'audit_logs', 'resource_relationships', 'user_mfa_totp']);
    if (!supportedTables.has(tableName)) {
      throw new Error(`Unsupported SQLite schema table '${tableName}'.`);
    }
    const columns = this.all<{ name: string }>(`PRAGMA table_info(${tableName})`);
    return columns.some((column) => column.name === columnName);
  }

  close(): void {
    this.assertOwnership();
    this.database.close();
  }
}
