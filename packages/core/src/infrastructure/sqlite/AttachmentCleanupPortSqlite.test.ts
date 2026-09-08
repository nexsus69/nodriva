/** Verifies leased and retryable attachment cleanup work in SQLite. */
import { describe, expect, it } from 'vitest';
import { AttachmentCleanupPortSqlite } from './AttachmentCleanupPortSqlite.js';
import { SqliteDatabase } from './SqliteDatabase.js';
import { ensureSqliteSchema } from './SqliteSchema.js';

describe('AttachmentCleanupPortSqlite', () => {
  it('leases due cleanup work, recovers stale leases and completes only for their owner', async () => {
    const database = new SqliteDatabase();
    ensureSqliteSchema(database);
    let now = new Date('2026-09-08T10:00:00.000Z');
    const queue = new AttachmentCleanupPortSqlite(database, () => now);

    await queue.schedule('entity/one/blob.bin', now);
    await expect(queue.claimPending('worker-1', 10)).resolves.toEqual([
      { storageKey: 'entity/one/blob.bin' },
    ]);
    await expect(queue.claimPending('worker-2', 10)).resolves.toEqual([]);
    await queue.markCompleted('entity/one/blob.bin', 'worker-2');
    expect(database.get('SELECT 1 FROM attachment_cleanup_outbox')).toBeDefined();

    now = new Date('2026-09-08T10:06:00.000Z');
    await expect(queue.claimPending('worker-2', 10)).resolves.toEqual([
      { storageKey: 'entity/one/blob.bin' },
    ]);
    await queue.markCompleted('entity/one/blob.bin', 'worker-2');
    expect(database.get('SELECT 1 FROM attachment_cleanup_outbox')).toBeUndefined();
    database.close();
  });

  it('cancels upload staging and keeps failed cleanup retryable', async () => {
    const database = new SqliteDatabase();
    ensureSqliteSchema(database);
    let now = new Date('2026-09-08T10:00:00.000Z');
    const queue = new AttachmentCleanupPortSqlite(database, () => now);

    await queue.schedule('staged', new Date(now.getTime() + 60_000));
    await queue.cancel('staged');
    expect(database.get('SELECT 1 FROM attachment_cleanup_outbox')).toBeUndefined();

    await queue.schedule('orphan', now);
    await queue.claimPending('worker', 1);
    await queue.markFailed('orphan', 'worker', 'storage unavailable');
    expect(database.get<{ attempts: number; locked_by: string | null; last_error: string }>(
      'SELECT attempts,locked_by,last_error FROM attachment_cleanup_outbox WHERE storage_key=?',
      ['orphan'],
    )).toEqual({ attempts: 1, locked_by: null, last_error: 'storage unavailable' });
    await expect(queue.claimPending('worker', 1)).resolves.toEqual([]);
    now = new Date('2026-09-08T10:00:03.000Z');
    await expect(queue.claimPending('worker', 1)).resolves.toEqual([{ storageKey: 'orphan' }]);
    database.close();
  });
});
