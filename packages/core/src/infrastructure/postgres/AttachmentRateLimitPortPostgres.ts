/** Serializes upload accounting before reading the current rate-limit window. */
import type { AttachmentRateLimitPort } from '../../application/ports/AttachmentRateLimitPort.js';
import type { PgExecutor } from './PgExecutor.js';

export class AttachmentRateLimitPortPostgres implements AttachmentRateLimitPort {
  constructor(private readonly executor: PgExecutor) {}

  async consume(actorId: string, limit: number, now = new Date()): Promise<boolean> {
    return this.executor.runInTransaction(async () => {
      await this.executor.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`attachment-upload:${actorId}`]);
      const result = await this.executor.query<{ consumed: boolean }>(
        `WITH deleted AS (
           DELETE FROM attachment_upload_events event
           WHERE event.actor_id=$1::uuid AND event.occurred_at <= $2::timestamptz - INTERVAL '1 hour'
           RETURNING 1
         ), cleanup AS MATERIALIZED (
           SELECT count(*) FROM deleted
         ), recent AS (
           SELECT count(*)::integer AS count FROM attachment_upload_events event, cleanup
           WHERE event.actor_id=$1::uuid AND event.occurred_at > $2::timestamptz - INTERVAL '1 hour'
         ), inserted AS (
           INSERT INTO attachment_upload_events(actor_id, occurred_at)
           SELECT $1::uuid, $2::timestamptz FROM recent WHERE recent.count < $3::integer
           RETURNING 1
         )
         SELECT EXISTS(SELECT 1 FROM inserted) AS consumed`,
        [actorId, now, limit],
      );
      return result.rows[0]?.consumed === true;
    });
  }
}
