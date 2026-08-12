import { describe, expect, it, vi } from 'vitest';
import { SqliteDatabase } from './SqliteDatabase.js';
import { TransactionPortSqlite } from './TransactionPortSqlite.js';

describe('TransactionPortSqlite', () => {
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
});
