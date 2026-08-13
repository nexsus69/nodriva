import { UnauthorizedError } from '../../domain/errors/ApplicationErrors.js';
import type { LoginRateLimitPort } from '../../application/ports/LoginRateLimitPort.js';
import type { SqliteDatabase } from './SqliteDatabase.js';

const WINDOW_MS = 15 * 60 * 1000;
export class LoginRateLimitPortSqlite implements LoginRateLimitPort {
  constructor(private readonly database: SqliteDatabase) {}
  async assertAllowed(subject: string, now: Date): Promise<void> { const row = this.database.get<{ blocked_until: string | null }>('SELECT blocked_until FROM login_rate_limits WHERE subject_hash=?', [subject]); if (row?.blocked_until && new Date(row.blocked_until) > now) throw new UnauthorizedError('Invalid credentials'); }
  async recordFailure(subject: string, now: Date): Promise<void> { const row = this.database.get<{ attempts: number; window_started_at: string }>('SELECT attempts,window_started_at FROM login_rate_limits WHERE subject_hash=?', [subject]); const reset = !row || now.getTime() - new Date(row.window_started_at).getTime() >= WINDOW_MS; const attempts = reset ? 1 : row.attempts + 1; const blocked = attempts >= 5 ? new Date(now.getTime() + WINDOW_MS).toISOString() : null; this.database.run('INSERT INTO login_rate_limits (subject_hash,attempts,window_started_at,blocked_until,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(subject_hash) DO UPDATE SET attempts=excluded.attempts,window_started_at=excluded.window_started_at,blocked_until=excluded.blocked_until,updated_at=excluded.updated_at', [subject, attempts, reset ? now.toISOString() : row.window_started_at, blocked, now.toISOString()]); }
  async clear(subject: string): Promise<void> { this.database.run('DELETE FROM login_rate_limits WHERE subject_hash=?', [subject]); }
}
