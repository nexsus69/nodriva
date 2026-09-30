/** Verifies connection isolation, rollback and post-commit reentrancy. */
import { describe, expect, it, vi } from 'vitest';
import { SqliteDatabase } from './SqliteDatabase.js';
import { TransactionPortSqlite } from './TransactionPortSqlite.js';

describe('TransactionPortSqlite', () => {
  it('queues independent adapter reads and writes until rollback and rejects raw interleaving', async () => {
    const database = new SqliteDatabase();
    database.exec('CREATE TABLE records (value TEXT)');
    const transactions = new TransactionPortSqlite(database);
    class Repository {
      constructor() { database.protectAsyncMethods(this); }
      async read() { return database.all('SELECT value FROM records'); }
      async write() { database.run("INSERT INTO records VALUES ('independent')"); }
    }
    const repository = new Repository();
    let entered!: () => void;
    let release!: () => void;
    const ready = new Promise<void>((resolve) => { entered = resolve; });
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const pending = transactions.runInTransaction(async () => {
      database.run("INSERT INTO records VALUES ('uncommitted')");
      entered();
      await gate;
      throw new Error('rollback');
    });
    const rejected = expect(pending).rejects.toThrow('rollback');
    await ready;
    expect(() => database.all('SELECT * FROM records')).toThrow('active asynchronous owner');
    const read = repository.read();
    const write = repository.write();
    release();
    await rejected;
    expect(await read).toEqual([]);
    await write;
    expect(await repository.read()).toEqual([{ value: 'independent' }]);
    database.close();
  });

  it('releases the connection before an after-commit effect opens another transaction', async () => {
    const database = new SqliteDatabase();
    const transactions = new TransactionPortSqlite(database);
    database.exec('CREATE TABLE records (value TEXT)');
    await transactions.runInTransaction(async () => {
      transactions.afterCommit(() => transactions.runInTransaction(async () => {
        database.run("INSERT INTO records VALUES ('effect')");
      }));
    });
    expect(database.all('SELECT * FROM records')).toEqual([{ value: 'effect' }]);
    database.close();
  });
  it('commits nested work and runs afterCommit once', async () => {
    const database = new SqliteDatabase();
    database.exec('CREATE TABLE records (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
    const transactions = new TransactionPortSqlite(database);
    const effect = vi.fn();

    await transactions.runInTransaction(async () => {
      database.run('INSERT INTO records (value) VALUES (?)', ['outer']);
      transactions.afterCommit(effect);
      await transactions.runInTransaction(async () => {
        database.run('INSERT INTO records (value) VALUES (?)', ['inner']);
      });
    });

    expect(database.all<{ value: string }>('SELECT value FROM records ORDER BY id')).toEqual([
      { value: 'outer' }, { value: 'inner' },
    ]);
    expect(effect).toHaveBeenCalledOnce();
    database.close();
  });

  it('rolls back all nested work and does not run afterCommit', async () => {
    const database = new SqliteDatabase();
    database.exec('CREATE TABLE records (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
    const transactions = new TransactionPortSqlite(database);
    const effect = vi.fn();

    await expect(transactions.runInTransaction(async () => {
      database.run('INSERT INTO records (value) VALUES (?)', ['outer']);
      transactions.afterCommit(effect);
      await transactions.runInTransaction(async () => {
        database.run('INSERT INTO records (value) VALUES (?)', ['inner']);
        throw new Error('rollback');
      });
    })).rejects.toThrow('rollback');

    expect(database.all('SELECT value FROM records')).toEqual([]);
    expect(effect).not.toHaveBeenCalled();
    database.close();
  });

  it('serializes independent concurrent transactions on the shared connection', async () => {
    const database = new SqliteDatabase();
    database.exec('CREATE TABLE records (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
    const transactions = new TransactionPortSqlite(database);
    let releaseFirst!: () => void;
    const firstMayFinish = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const order: string[] = [];

    const first = transactions.runInTransaction(async () => {
      order.push('first-start');
      database.run('INSERT INTO records (value) VALUES (?)', ['first']);
      await firstMayFinish;
      order.push('first-end');
    });
    await Promise.resolve();
    const second = transactions.runInTransaction(async () => {
      order.push('second-start');
      database.run('INSERT INTO records (value) VALUES (?)', ['second']);
    });
    await Promise.resolve();

    expect(order).toEqual(['first-start']);
    releaseFirst();
    await Promise.all([first, second]);
    expect(order).toEqual(['first-start', 'first-end', 'second-start']);
    expect(database.all<{ value: string }>('SELECT value FROM records ORDER BY id')).toEqual([
      { value: 'first' }, { value: 'second' },
    ]);
    database.close();
  });
});
