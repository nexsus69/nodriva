import { describe, expect, it } from 'vitest';
import { Lock } from '../../domain/models/Lock.js';
import { LockConflictError, LockForbiddenError } from '../../domain/errors/ApplicationErrors.js';
import { ensureSqliteSchema } from './SqliteSchema.js';
import { SqliteDatabase } from './SqliteDatabase.js';
import { LockRepositorySqlite } from './LockRepositorySqlite.js';

describe('LockRepositorySqlite', () => {
  it('enforces ownership and supports refresh/release', async () => {
    const database = new SqliteDatabase(); ensureSqliteSchema(database);
    const repository = new LockRepositorySqlite(database, () => new Date('2026-01-01T00:00:00Z'));
    const resource = { resourceType: 'node' as const, resourceId: 'node-1' };
    await repository.acquire(new Lock('lock-1', resource, 'user-1', 'session-1', new Date('2026-01-01T00:00:00Z'), new Date('2026-01-01T00:01:00Z')));
    await expect(repository.acquire(new Lock('lock-2', resource, 'user-2', 'session-2', new Date(), new Date()))).rejects.toBeInstanceOf(LockConflictError);
    await expect(repository.release(resource, 'user-2', 'session-2')).rejects.toBeInstanceOf(LockForbiddenError);
    await repository.refresh(resource, 'user-1', 'session-1', new Date('2026-01-01T00:02:00Z'));
    await repository.release(resource, 'user-1', 'session-1');
    await expect(repository.getLock(resource)).resolves.toBeNull();
    database.close();
  });
});
