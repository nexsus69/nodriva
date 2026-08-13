import { describe, expect, it } from 'vitest';
import type { AttachmentRecord } from '../../application/ports/AttachmentRepository.js';
import { AttachmentRateLimitPortSqlite } from './AttachmentRateLimitPortSqlite.js';
import { AttachmentRepositorySqlite } from './AttachmentRepositorySqlite.js';
import { SqliteDatabase } from './SqliteDatabase.js';
import { ensureSqliteSchema } from './SqliteSchema.js';

const record = (id: string, sizeBytes: number): AttachmentRecord => ({
  id,
  resourceType: 'node',
  resourceId: 'node-1',
  fieldKey: 'files',
  kind: 'file',
  fileName: `${id}.txt`,
  mimeType: 'text/plain',
  sizeBytes,
  storageKey: `node-1/${id}.txt`,
  checksum: id,
  createdBy: 'user-1',
});

describe('SQLite attachment persistence controls', () => {
  it('enforces the resource quota in the insert statement', async () => {
    const database = new SqliteDatabase();
    ensureSqliteSchema(database);
    const repository = new AttachmentRepositorySqlite(database);

    await expect(repository.createWithinQuota(record('first', 60), 100)).resolves.toBe(true);
    await expect(repository.createWithinQuota(record('second', 50), 100)).resolves.toBe(false);
    await expect(repository.getResourceQuota('node', 'node-1')).resolves.toBe(60);
    database.close();
  });

  it('persists the rolling upload limit and expires old events', async () => {
    const database = new SqliteDatabase();
    ensureSqliteSchema(database);
    const limiter = new AttachmentRateLimitPortSqlite(database);
    const start = new Date('2026-01-01T00:00:00.000Z');

    await expect(limiter.consume('user-1', 2, start)).resolves.toBe(true);
    await expect(limiter.consume('user-1', 2, new Date(start.getTime() + 1000))).resolves.toBe(true);
    await expect(limiter.consume('user-1', 2, new Date(start.getTime() + 2000))).resolves.toBe(false);
    await expect(limiter.consume('user-1', 2, new Date(start.getTime() + 3_600_001))).resolves.toBe(true);
    database.close();
  });
});
