import { SessionRepositoryPort } from '../../application/ports/SessionRepositoryPort.js';
import { PgExecutor } from './PgExecutor.js';

export class SessionRepositoryPostgres implements SessionRepositoryPort {
  constructor(private readonly executor: PgExecutor) {}

  async createSession(userId: string, token: string, expiresAt: Date): Promise<void> {
    await this.executor.query(
      `INSERT INTO user_sessions (user_id, session_token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, token, expiresAt]
    );
  }

  async getSessionUserId(token: string): Promise<string | null> {
    const res = await this.executor.query(
      `UPDATE user_sessions
       SET last_seen_at = now(),
           updated_at = now(),
           expires_at = now() + interval '30 minutes'
       WHERE session_token_hash = $1
         AND status = 'active'::session_status_enum
         AND expires_at > now()
       RETURNING user_id`,
      [token]
    );
    if (res.rows.length === 0) return null;
    return res.rows[0]?.user_id as string | null;
  }

  async deleteSession(token: string): Promise<void> {
    await this.executor.query(
      `DELETE FROM user_sessions WHERE session_token_hash = $1`,
      [token]
    );
  }

  async deleteSessionsForUser(userId: string): Promise<void> {
    await this.executor.query(
      `DELETE FROM user_sessions WHERE user_id = $1`,
      [userId]
    );
  }
}
