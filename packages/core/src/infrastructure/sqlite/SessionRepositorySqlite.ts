/** Implements SessionRepositorySqlite within its adapter or regression boundary. */
import type { SessionRepositoryPort } from '../../application/ports/SessionRepositoryPort.js';
import type { SqliteDatabase } from './SqliteDatabase.js';
import { randomUUID } from 'node:crypto';

export class SessionRepositorySqlite implements SessionRepositoryPort {
  constructor(private readonly database: SqliteDatabase, private readonly now: () => Date = () => new Date()) {
    this.database.protectAsyncMethods(this);
  }
  async createSession(userId: string, token: string, expiresAt: Date): Promise<string> { const id = randomUUID(); this.database.run('INSERT INTO user_sessions (id,user_id,session_token_hash,expires_at) VALUES (?,?,?,?)', [id, userId, token, expiresAt.toISOString()]); return id; }
  async getSessionUserId(token: string): Promise<string | null> { return this.database.get<{ user_id: string }>('SELECT user_id FROM user_sessions WHERE session_token_hash=? AND status=? AND expires_at>?', [token, 'active', this.now().toISOString()])?.user_id ?? null; }
  async getActiveSessionExpiry(sessionId: string, userId: string): Promise<Date | null> { const row = this.database.get<{ expires_at: string }>('SELECT expires_at FROM user_sessions WHERE id=? AND user_id=? AND status=? AND expires_at>?', [sessionId, userId, 'active', this.now().toISOString()]); return row ? new Date(row.expires_at) : null; }
  async touchSession(sessionId: string, userId: string, expiresAt: Date): Promise<boolean> { return this.database.run('UPDATE user_sessions SET last_seen_at=?,updated_at=?,expires_at=? WHERE id=? AND user_id=? AND status=? AND expires_at>?', [this.now().toISOString(), this.now().toISOString(), expiresAt.toISOString(), sessionId, userId, 'active', this.now().toISOString()]).changes > 0; }
  async deleteSession(token: string): Promise<void> { this.database.run('DELETE FROM user_sessions WHERE session_token_hash=?', [token]); }
  async deleteSessionsForUser(userId: string): Promise<void> { this.database.run('DELETE FROM user_sessions WHERE user_id=?', [userId]); }
}
