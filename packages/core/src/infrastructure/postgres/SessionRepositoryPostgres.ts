import type { SessionRepositoryPort } from '../../application/ports/SessionRepositoryPort.js';
import type { PgExecutor } from './PgExecutor.js';

export class SessionRepositoryPostgres implements SessionRepositoryPort {
  constructor(private readonly executor: PgExecutor) {}

  async createSession(userId: string, token: string, expiresAt: Date): Promise<string> {
    const result = await this.executor.query<{ id: string }>(
      `INSERT INTO user_sessions (user_id, session_token_hash, expires_at)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [userId, token, expiresAt]
    );
    return result.rows[0]!.id;
  }

  async getSessionUserId(token: string): Promise<string | null> {
    const res = await this.executor.query(
      `SELECT user_id
       FROM user_sessions
       WHERE session_token_hash = $1
         AND status = 'active'::session_status_enum
         AND expires_at > now()`,
      [token]
    );
    if (res.rows.length === 0) return null;
    return res.rows[0]?.user_id as string | null;
  }

  async getActiveSessionExpiry(sessionId: string, userId: string): Promise<Date | null> {
    const result = await this.executor.query<{ expires_at: Date }>(
      `SELECT expires_at
       FROM user_sessions
       WHERE id = $1
         AND user_id = $2
         AND status = 'active'::session_status_enum
         AND expires_at > now()`,
      [sessionId, userId],
    );
    return result.rows[0]?.expires_at ?? null;
  }

  async touchSession(sessionId: string, userId: string, expiresAt: Date): Promise<boolean> {
    const result = await this.executor.query(
      `UPDATE user_sessions
       SET last_seen_at = now(),
           updated_at = now(),
           expires_at = $3
       WHERE id = $1
         AND user_id = $2
         AND status = 'active'::session_status_enum
         AND expires_at > now()`,
      [sessionId, userId, expiresAt],
    );
    return (result.rowCount ?? 0) > 0;
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
