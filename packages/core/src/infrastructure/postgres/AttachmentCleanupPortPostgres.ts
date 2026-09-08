/** Implements leased attachment cleanup work in PostgreSQL. */
import type { AttachmentCleanupPort, PendingAttachmentCleanup } from '../../application/ports/AttachmentCleanupPort.js';
import type { PgExecutor } from './PgExecutor.js';

export class AttachmentCleanupPortPostgres implements AttachmentCleanupPort {
  constructor(private readonly executor: PgExecutor) {}
  async schedule(storageKey: string, notBefore: Date): Promise<void> { await this.executor.query('INSERT INTO attachment_cleanup_outbox(storage_key,next_attempt_at) VALUES($1,$2) ON CONFLICT(storage_key) DO UPDATE SET next_attempt_at=EXCLUDED.next_attempt_at,locked_at=NULL,locked_by=NULL', [storageKey, notBefore]); }
  async cancel(storageKey: string): Promise<void> { await this.executor.query('DELETE FROM attachment_cleanup_outbox WHERE storage_key=$1', [storageKey]); }
  async claimPending(workerId: string, limit: number): Promise<PendingAttachmentCleanup[]> { const result = await this.executor.query<{ storageKey: string }>(`WITH candidates AS (SELECT storage_key FROM attachment_cleanup_outbox WHERE next_attempt_at<=NOW() AND (locked_at IS NULL OR locked_at<NOW()-interval '5 minutes') ORDER BY next_attempt_at,storage_key FOR UPDATE SKIP LOCKED LIMIT $2) UPDATE attachment_cleanup_outbox cleanup SET locked_at=NOW(),locked_by=$1 FROM candidates WHERE cleanup.storage_key=candidates.storage_key RETURNING cleanup.storage_key AS "storageKey"`, [workerId, limit]); return result.rows; }
  async markCompleted(storageKey: string, workerId: string): Promise<void> { await this.executor.query('DELETE FROM attachment_cleanup_outbox WHERE storage_key=$1 AND locked_by=$2', [storageKey, workerId]); }
  async markFailed(storageKey: string, workerId: string, error: string): Promise<void> { await this.executor.query("UPDATE attachment_cleanup_outbox SET attempts=attempts+1,last_error=$3,next_attempt_at=NOW()+LEAST((2 ^ LEAST(attempts,8))*interval '1 second',interval '15 minutes'),locked_at=NULL,locked_by=NULL WHERE storage_key=$1 AND locked_by=$2", [storageKey, workerId, error.slice(0, 1000)]); }
}
