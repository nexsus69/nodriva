import type { LockRepository } from '../../application/ports/LockRepository.js';
import { Lock } from '../../domain/models/Lock.js';
import { LockConflictError, LockNotFoundError, LockForbiddenError } from '../../domain/errors/ApplicationErrors.js';
import type { PgExecutor } from './PgExecutor.js';
import type { ResourceKind, ResourceReference } from '../../domain/models/ResourceReference.js';

interface LockRow {
  id: string;
  resource_type: string;
  resource_id: string;
  user_id: string;
  session_id: string;
  acquired_at: Date;
  expires_at: Date;
}

export class LockRepositoryPostgres implements LockRepository {
  constructor(private readonly executor: PgExecutor) {}

  async acquire(lock: Lock): Promise<void> {
    const query = `
      INSERT INTO locks (id, resource_type, resource_id, user_id, session_id, acquired_at, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (resource_type, resource_id) 
      DO UPDATE SET 
        id = EXCLUDED.id,
        user_id = EXCLUDED.user_id,
        session_id = EXCLUDED.session_id,
        acquired_at = EXCLUDED.acquired_at,
        expires_at = EXCLUDED.expires_at
      WHERE locks.expires_at < now() OR locks.session_id = EXCLUDED.session_id
      RETURNING id
    `;

    const result = await this.executor.query(query, [
      lock.id,
      lock.resourceType,
      lock.resourceId,
      lock.userId,
      lock.sessionId,
      lock.acquiredAt,
      lock.expiresAt
    ]);

    if (result.rowCount === 0) {
      // Significa che c'era un conflitto: il lock esiste, non è scaduto e appartiene a un altro utente.
      throw new LockConflictError(lock.resourceType, lock.resourceId);
    }
  }

  async refresh(resource: ResourceReference, userId: string, sessionId: string, newExpiresAt: Date): Promise<void> {
    const query = `
      UPDATE locks
      SET expires_at = $1
      WHERE resource_type = $2 AND resource_id = $3 AND user_id = $4 AND session_id = $5 AND expires_at >= now()
      RETURNING id
    `;
    
    const result = await this.executor.query(query, [newExpiresAt, resource.resourceType, resource.resourceId, userId, sessionId]);
    if (result.rowCount === 0) {
      // Se non aggiorna, controlliamo il motivo per lanciare l'errore specifico
      const checkQuery = `SELECT user_id, session_id, expires_at FROM locks WHERE resource_type = $1 AND resource_id = $2`;
      const checkRes = await this.executor.query<{user_id: string; session_id: string; expires_at: Date}>(checkQuery, [resource.resourceType, resource.resourceId]);
      
      const row = checkRes.rows[0];
      if (!checkRes.rowCount || !row || row.expires_at < new Date()) {
        throw new LockNotFoundError(resource.resourceType, resource.resourceId);
      } else {
        throw new LockConflictError(resource.resourceType, resource.resourceId);
      }
    }
  }

  async release(resource: ResourceReference, userId: string, sessionId: string): Promise<void> {
    const query = `
      DELETE FROM locks
      WHERE resource_type = $1 AND resource_id = $2 AND user_id = $3 AND session_id = $4
      RETURNING id
    `;
    
    const result = await this.executor.query(query, [resource.resourceType, resource.resourceId, userId, sessionId]);
    if (result.rowCount === 0) {
      // Controlliamo perché non ha cancellato
      const checkQuery = `SELECT user_id, session_id FROM locks WHERE resource_type = $1 AND resource_id = $2`;
      const checkRes = await this.executor.query<{user_id: string; session_id: string}>(checkQuery, [resource.resourceType, resource.resourceId]);
      
      const row = checkRes.rows[0];
      if ((checkRes.rowCount ?? 0) > 0 && row && (row.user_id !== userId || row.session_id !== sessionId)) {
        throw new LockForbiddenError(resource.resourceType, resource.resourceId);
      }
      // Se non esiste, non facciamo nulla (idempotenza).
    }
  }

  async releaseAllForSession(sessionId: string): Promise<Lock[]> {
    const result = await this.executor.query<LockRow>(
      `DELETE FROM locks
       WHERE session_id = $1
       RETURNING id, resource_type, resource_id, user_id, session_id, acquired_at, expires_at`,
      [sessionId],
    );
    return result.rows.map((row) => this.toLock(row));
  }

  async forceRelease(resource: ResourceReference): Promise<void> {
    const query = `
      DELETE FROM locks
      WHERE resource_type = $1 AND resource_id = $2
    `;
    await this.executor.query(query, [resource.resourceType, resource.resourceId]);
  }

  async getLock(resource: ResourceReference): Promise<Lock | null> {
    const query = `
      SELECT id, resource_type, resource_id, user_id, session_id, acquired_at, expires_at
      FROM locks
      WHERE resource_type = $1 AND resource_id = $2
    `;
    const result = await this.executor.query<LockRow>(query, [resource.resourceType, resource.resourceId]);
    
    if (!result.rowCount || result.rows.length === 0) return null;
    
    return this.toLock(result.rows[0]!);
  }

  private toLock(row: LockRow): Lock {
    return new Lock(
      row.id,
      { resourceType: row.resource_type as ResourceKind, resourceId: row.resource_id },
      row.user_id,
      row.session_id,
      row.acquired_at,
      row.expires_at
    );
  }
}
