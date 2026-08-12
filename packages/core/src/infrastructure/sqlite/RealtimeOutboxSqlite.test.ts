import { describe, expect, it } from 'vitest';
import { SqliteDatabase } from './SqliteDatabase.js';
import { ensureSqliteSchema } from './SqliteSchema.js';
import { RealtimeOutboxSqlite } from './RealtimeOutboxSqlite.js';

describe('RealtimeOutboxSqlite', () => {
  it('deduplicates, leases and publishes events', async () => {
    const database = new SqliteDatabase(); ensureSqliteSchema(database);
    const outbox = new RealtimeOutboxSqlite(database);
    const event = { eventId: 'event-1', resourceType: 'node' as const, resourceId: 'node', occurredAt: new Date().toISOString(), changeType: 'updated' as const, actorUserId: 'user' };
    await outbox.enqueue(event); await outbox.enqueue(event);
    await expect(outbox.claimPending('worker', 10)).resolves.toEqual([event]);
    await outbox.markPublished(event.eventId, 'worker');
    await expect(outbox.claimPending('worker-2', 10)).resolves.toEqual([]);
    await expect(outbox.getOperationalStats()).resolves.toMatchObject({ pendingCount: 0 });
    database.close();
  });
});
