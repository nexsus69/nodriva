import type { RealtimeOutboxPort, RealtimeOutboxOperationalStats } from '../../application/ports/RealtimeOutboxPort.js';
import type { RealtimeDataChangedEvent } from '../../application/ports/RealtimeEventBus.js';
import type { PgExecutor } from './PgExecutor.js';

interface OutboxRow { event_payload: RealtimeDataChangedEvent; }

/** PostgreSQL outbox with short-lived leases so concurrent workers publish
 * each event at most once per lease window. Clients still deduplicate by id,
 * preserving safe at-least-once delivery after a process crash. */
export class RealtimeOutboxPostgres implements RealtimeOutboxPort {
  constructor(private readonly executor: PgExecutor) {}

  async enqueue(event: RealtimeDataChangedEvent): Promise<void> {
    await this.executor.query(
      `WITH assigned AS (
         SELECT CASE WHEN $2::jsonb ? 'metadataKind'
           THEN nextval('realtime_metadata_event_sequence')
           ELSE NULL END AS metadata_sequence
       )
       INSERT INTO realtime_event_outbox (event_id, event_payload)
       SELECT $1,
         CASE WHEN assigned.metadata_sequence IS NULL THEN $2::jsonb
           ELSE jsonb_set($2::jsonb, '{metadataSequence}', to_jsonb(assigned.metadata_sequence), true)
         END
       FROM assigned
       ON CONFLICT (event_id) DO NOTHING`,
      [event.eventId, JSON.stringify(event)]
    );
  }

  async claimPending(workerId: string, limit: number): Promise<RealtimeDataChangedEvent[]> {
    const result = await this.executor.query<OutboxRow>(
      `WITH candidates AS (
         SELECT event_id FROM realtime_event_outbox
         WHERE published_at IS NULL
           AND (next_attempt_at IS NULL OR next_attempt_at <= now())
           AND (locked_at IS NULL OR locked_at < now() - interval '5 minutes')
         ORDER BY created_at ASC FOR UPDATE SKIP LOCKED LIMIT $2
       )
       UPDATE realtime_event_outbox outbox
       SET locked_at = now(), locked_by = $1
       FROM candidates WHERE outbox.event_id = candidates.event_id
       RETURNING outbox.event_payload`,
      [workerId, limit]
    );
    return result.rows.map((row) => row.event_payload);
  }

  async markPublished(eventId: string, workerId: string): Promise<void> {
    await this.executor.query(
      `UPDATE realtime_event_outbox
       SET published_at = now(), last_error = NULL, locked_at = NULL, locked_by = NULL
       WHERE event_id = $1 AND locked_by = $2`,
      [eventId, workerId]
    );
  }

  async markFailed(eventId: string, workerId: string, error: string): Promise<void> {
    await this.executor.query(
      `UPDATE realtime_event_outbox
       SET attempts = attempts + 1, last_error = $2,
           next_attempt_at = now() + LEAST((2 ^ LEAST(attempts, 8)) * interval '1 second', interval '15 minutes'),
           locked_at = NULL, locked_by = NULL
       WHERE event_id = $1 AND locked_by = $3`,
      [eventId, error.slice(0, 1000), workerId]
    );
  }

  async getOperationalStats(): Promise<RealtimeOutboxOperationalStats> {
    const result = await this.executor.query<{
      pending_count: number; leased_count: number; retrying_count: number; oldest_pending_age_seconds: number; max_attempts: number;
    }>(`
      SELECT
        COUNT(*) FILTER (WHERE published_at IS NULL)::int AS pending_count,
        COUNT(*) FILTER (WHERE published_at IS NULL AND locked_at IS NOT NULL)::int AS leased_count,
        COUNT(*) FILTER (WHERE published_at IS NULL AND attempts > 0)::int AS retrying_count,
        COALESCE(EXTRACT(EPOCH FROM now() - MIN(created_at) FILTER (WHERE published_at IS NULL)), 0)::int AS oldest_pending_age_seconds,
        COALESCE(MAX(attempts) FILTER (WHERE published_at IS NULL), 0)::int AS max_attempts
      FROM realtime_event_outbox
    `);
    const row = result.rows[0];
    return {
      pendingCount: Number(row?.pending_count ?? 0), leasedCount: Number(row?.leased_count ?? 0),
      retryingCount: Number(row?.retrying_count ?? 0), oldestPendingAgeSeconds: Number(row?.oldest_pending_age_seconds ?? 0),
      maxAttempts: Number(row?.max_attempts ?? 0),
    };
  }
}
