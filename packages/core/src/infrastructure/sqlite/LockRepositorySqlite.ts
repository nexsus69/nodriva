/** Implements LockRepositorySqlite within its adapter or regression boundary. */
import { Lock } from '../../domain/models/Lock.js';
import { LockConflictError, LockForbiddenError, LockNotFoundError } from '../../domain/errors/ApplicationErrors.js';
import type { LockRepository } from '../../application/ports/LockRepository.js';
import type { ResourceKind, ResourceReference } from '../../domain/models/ResourceReference.js';
import type { SqliteDatabase } from './SqliteDatabase.js';

interface LockRow { id: string; resource_type: string; resource_id: string; user_id: string; session_id: string; acquired_at: string; expires_at: string; }

export class LockRepositorySqlite implements LockRepository {
  constructor(private readonly database: SqliteDatabase, private readonly now: () => Date = () => new Date()) {
    this.database.protectAsyncMethods(this);
  }

  async acquire(lock: Lock): Promise<void> {
    const result = this.database.run(`INSERT INTO locks (id,resource_type,resource_id,user_id,session_id,acquired_at,expires_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(resource_type,resource_id) DO UPDATE SET id=excluded.id,user_id=excluded.user_id,session_id=excluded.session_id,acquired_at=excluded.acquired_at,expires_at=excluded.expires_at WHERE locks.expires_at < ? OR locks.session_id = excluded.session_id`, [lock.id, lock.resourceType, lock.resourceId, lock.userId, lock.sessionId, lock.acquiredAt.toISOString(), lock.expiresAt.toISOString(), this.now().toISOString()]);
    if (result.changes === 0) throw new LockConflictError(lock.resourceType, lock.resourceId);
  }

  async refresh(resource: ResourceReference, userId: string, sessionId: string, newExpiresAt: Date): Promise<void> {
    const result = this.database.run('UPDATE locks SET expires_at=? WHERE resource_type=? AND resource_id=? AND user_id=? AND session_id=? AND expires_at >= ?', [newExpiresAt.toISOString(), resource.resourceType, resource.resourceId, userId, sessionId, this.now().toISOString()]);
    if (result.changes > 0) return;
    const row = this.database.get<LockRow>('SELECT * FROM locks WHERE resource_type=? AND resource_id=?', [resource.resourceType, resource.resourceId]);
    if (!row || new Date(row.expires_at) < this.now()) throw new LockNotFoundError(resource.resourceType, resource.resourceId);
    throw new LockConflictError(resource.resourceType, resource.resourceId);
  }

  async release(resource: ResourceReference, userId: string, sessionId: string): Promise<void> {
    const result = this.database.run('DELETE FROM locks WHERE resource_type=? AND resource_id=? AND user_id=? AND session_id=?', [resource.resourceType, resource.resourceId, userId, sessionId]);
    if (result.changes > 0) return;
    const row = this.database.get<LockRow>('SELECT * FROM locks WHERE resource_type=? AND resource_id=?', [resource.resourceType, resource.resourceId]);
    if (row && (row.user_id !== userId || row.session_id !== sessionId)) throw new LockForbiddenError(resource.resourceType, resource.resourceId);
  }

  async releaseAllForSession(sessionId: string): Promise<Lock[]> {
    const rows = this.database.all<LockRow>('SELECT * FROM locks WHERE session_id=?', [sessionId]);
    this.database.run('DELETE FROM locks WHERE session_id=?', [sessionId]);
    return rows.map((row) => this.map(row));
  }

  async forceRelease(resource: ResourceReference): Promise<void> { this.database.run('DELETE FROM locks WHERE resource_type=? AND resource_id=?', [resource.resourceType, resource.resourceId]); }

  async getLock(resource: ResourceReference): Promise<Lock | null> {
    const row = this.database.get<LockRow>('SELECT * FROM locks WHERE resource_type=? AND resource_id=?', [resource.resourceType, resource.resourceId]);
    return row ? this.map(row) : null;
  }

  private map(row: LockRow): Lock { return new Lock(row.id, { resourceType: row.resource_type as ResourceKind, resourceId: row.resource_id }, row.user_id, row.session_id, new Date(row.acquired_at), new Date(row.expires_at)); }
}
