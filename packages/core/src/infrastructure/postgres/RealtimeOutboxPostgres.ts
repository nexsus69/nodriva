import { RealtimeOutboxPort } from '../../application/ports/RealtimeOutboxPort.js';
import { RealtimeDataChangedEvent } from '../../application/ports/RealtimeEventBus.js';
import { PgExecutor } from './PgExecutor.js';

interface OutboxRow {
  event_payload: RealtimeDataChangedEvent;
}

export class RealtimeOutboxPostgres implements RealtimeOutboxPort {
  constructor(private readonly executor: PgExecutor) {}

  async enqueue(event: RealtimeDataChangedEvent): Promise<void> {
    await this.executor.query(
      `INSERT INTO realtime_event_outbox (event_id, event_payload)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (event_id) DO NOTHING`,
      [event.eventId, JSON.stringify(event)]
    );
  }

  async listPending(limit: number): Promise<RealtimeDataChangedEvent[]> {
    const result = await this.executor.query<OutboxRow>(
      `SELECT event_payload
       FROM realtime_event_outbox
       WHERE published_at IS NULL
         AND (next_attempt_at IS NULL OR next_attempt_at <= now())
       ORDER BY created_at ASC
       LIMIT $1`,
      [limit]
    );
    return result.rows.map((row) => row.event_payload);
  }

  async markPublished(eventId: string): Promise<void> {
    await this.executor.query(
      `UPDATE realtime_event_outbox
       SET published_at = now(), last_error = NULL
       WHERE event_id = $1`,
      [eventId]
    );
  }

  async markFailed(eventId: string, error: string): Promise<void> {
    await this.executor.query(
      `UPDATE realtime_event_outbox
       SET attempts = attempts + 1,
           last_error = $2,
           next_attempt_at = now() + LEAST((2 ^ LEAST(attempts, 8)) * interval '1 second', interval '15 minutes')
       WHERE event_id = $1`,
      [eventId, error.slice(0, 1000)]
    );
  }
}
