import type { AccountActionPurpose, AccountActionTokenPort } from '../../application/ports/AccountActionTokenPort.js';
import { SqliteDatabase } from './SqliteDatabase.js';

export class AccountActionTokenPortSqlite implements AccountActionTokenPort {
  constructor(private readonly database: SqliteDatabase) {}
  async create(input: { userId: string; purpose: AccountActionPurpose; tokenHash: string; expiresAt: Date; createdBy: string }): Promise<void> { this.database.run('INSERT INTO account_action_tokens (token_hash,user_id,purpose,expires_at,created_by) VALUES (?,?,?,?,?)', [input.tokenHash, input.userId, input.purpose, input.expiresAt.toISOString(), input.createdBy]); }
  async consume(tokenHash: string, now: Date): Promise<{ userId: string; purpose: AccountActionPurpose } | null> { const row = this.database.get<{ user_id: string; purpose: AccountActionPurpose }>('SELECT user_id,purpose FROM account_action_tokens WHERE token_hash=? AND consumed_at IS NULL AND expires_at>?', [tokenHash, now.toISOString()]); if (!row) return null; const result = this.database.run('UPDATE account_action_tokens SET consumed_at=? WHERE token_hash=? AND consumed_at IS NULL', [now.toISOString(), tokenHash]); return result.changes ? { userId: row.user_id, purpose: row.purpose } : null; }
}
