import type { LoginRateLimitPort } from '../../application/ports/LoginRateLimitPort.js';
import { UnauthorizedError } from '../../domain/errors/ApplicationErrors.js';
import type { PgExecutor } from './PgExecutor.js';

const MAX_FAILURES = 5;
const WINDOW_MINUTES = 15;

/** Shared, database-backed login throttle. The caller deliberately receives the
 * same UnauthorizedError as for invalid credentials to avoid account discovery. */
export class LoginRateLimitPortPostgres implements LoginRateLimitPort {
  constructor(private readonly executor: PgExecutor) {}

  async assertAllowed(subject: string, now: Date): Promise<void> {
    const result = await this.executor.query<{ blocked_until: Date | null }>(
      'SELECT blocked_until FROM login_rate_limits WHERE subject_hash = $1', [subject]
    );
    if (result.rows[0]?.blocked_until && result.rows[0].blocked_until > now) {
      throw new UnauthorizedError('Invalid credentials');
    }
  }

  async recordFailure(subject: string, now: Date): Promise<void> {
    await this.executor.query(
      `INSERT INTO login_rate_limits (subject_hash, attempts, window_started_at, blocked_until, updated_at)
       VALUES ($1, 1, $2, NULL, $2)
       ON CONFLICT (subject_hash) DO UPDATE
       SET attempts = CASE
             WHEN login_rate_limits.window_started_at < $2 - INTERVAL '${WINDOW_MINUTES} minutes' THEN 1
             ELSE login_rate_limits.attempts + 1 END,
           window_started_at = CASE
             WHEN login_rate_limits.window_started_at < $2 - INTERVAL '${WINDOW_MINUTES} minutes' THEN $2
             ELSE login_rate_limits.window_started_at END,
           blocked_until = CASE
             WHEN (CASE WHEN login_rate_limits.window_started_at < $2 - INTERVAL '${WINDOW_MINUTES} minutes'
                        THEN 1 ELSE login_rate_limits.attempts + 1 END) >= ${MAX_FAILURES}
             THEN $2 + INTERVAL '${WINDOW_MINUTES} minutes' ELSE NULL END,
           updated_at = $2`,
      [subject, now]
    );
  }

  async clear(subject: string): Promise<void> {
    await this.executor.query('DELETE FROM login_rate_limits WHERE subject_hash = $1', [subject]);
  }
}
