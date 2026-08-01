import { LockRepository } from '../../application/ports/LockRepository.js';
import { Lock } from '../../domain/models/Lock.js';
import { LockConflictError, LockNotFoundError, LockForbiddenError } from '../../domain/errors/ApplicationErrors.js';
import { PgExecutor } from './PgExecutor.js';

interface LockRow {
  id: string;
  resource_type: string;
  resource_id: string;
  user_id: string;
  acquired_at: Date;
  expires_at: Date;
}

export class LockRepositoryPostgres implements LockRepository {
  constructor(private readonly executor: PgExecutor) {}

  async acquire(lock: Lock): Promise<void> {
    const query = `
      INSERT INTO locks (id, resource_type, resource_id, user_id, acquired_at, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (resource_type, resource_id) 
      DO UPDATE SET 
        id = EXCLUDED.id,
        user_id = EXCLUDED.user_id,
        acquired_at = EXCLUDED.acquired_at,
        expires_at = EXCLUDED.expires_at
      WHERE locks.expires_at < now() OR locks.user_id = EXCLUDED.user_id
      RETURNING id
    `;

    const result = await this.executor.query(query, [
      lock.id,
      lock.resourceType,
      lock.resourceId,
      lock.userId,
      lock.acquiredAt,
      lock.expiresAt
    ]);

    if (result.rowCount === 0) {
      // Significa che c'era un conflitto: il lock esiste, non è scaduto e appartiene a un altro utente.
      throw new LockConflictError(lock.resourceType, lock.resourceId);
    }
  }

  async refresh(resourceType: string, resourceId: string, userId: string, newExpiresAt: Date): Promise<void> {
    const query = `
      UPDATE locks
      SET expires_at = $1
      WHERE resource_type = $2 AND resource_id = $3 AND user_id = $4 AND expires_at >= now()
      RETURNING id
    `;
    
    const result = await this.executor.query(query, [newExpiresAt, resourceType, resourceId, userId]);
    if (result.rowCount === 0) {
      // Se non aggiorna, controlliamo il motivo per lanciare l'errore specifico
      const checkQuery = `SELECT user_id, expires_at FROM locks WHERE resource_type = $1 AND resource_id = $2`;
      const checkRes = await this.executor.query<{user_id: string; expires_at: Date}>(checkQuery, [resourceType, resourceId]);
      
      const row = checkRes.rows[0];
      if (!checkRes.rowCount || !row || row.expires_at < new Date()) {
        throw new LockNotFoundError(resourceType, resourceId);
      } else {
        throw new LockConflictError(resourceType, resourceId);
      }
    }
  }

  async release(resourceType: string, resourceId: string, userId: string): Promise<void> {
    const query = `
      DELETE FROM locks
      WHERE resource_type = $1 AND resource_id = $2 AND user_id = $3
      RETURNING id
    `;
    
    const result = await this.executor.query(query, [resourceType, resourceId, userId]);
    if (result.rowCount === 0) {
      // Controlliamo perché non ha cancellato
      const checkQuery = `SELECT user_id FROM locks WHERE resource_type = $1 AND resource_id = $2`;
      const checkRes = await this.executor.query<{user_id: string}>(checkQuery, [resourceType, resourceId]);
      
      const row = checkRes.rows[0];
      if ((checkRes.rowCount ?? 0) > 0 && row && row.user_id !== userId) {
        throw new LockForbiddenError(resourceType, resourceId);
      }
      // Se non esiste, non facciamo nulla (idempotenza).
    }
  }

  async forceRelease(resourceType: string, resourceId: string): Promise<void> {
    const query = `
      DELETE FROM locks
      WHERE resource_type = $1 AND resource_id = $2
    `;
    await this.executor.query(query, [resourceType, resourceId]);
  }

  async getLock(resourceType: string, resourceId: string): Promise<Lock | null> {
    const query = `
      SELECT id, resource_type, resource_id, user_id, acquired_at, expires_at
      FROM locks
      WHERE resource_type = $1 AND resource_id = $2
    `;
    const result = await this.executor.query<LockRow>(query, [resourceType, resourceId]);
    
    if (!result.rowCount || result.rows.length === 0) return null;
    
    const row = result.rows[0]!;
    return new Lock(
      row.id,
      row.resource_type,
      row.resource_id,
      row.user_id,
      row.acquired_at,
      row.expires_at
    );
  }
}
