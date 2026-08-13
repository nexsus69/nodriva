import type { AccountActionTokenPort, AccountActionPurpose } from '../../application/ports/AccountActionTokenPort.js';
import type { PgExecutor } from './PgExecutor.js';

export class AccountActionTokenPortPostgres implements AccountActionTokenPort {
  constructor(private readonly executor: PgExecutor) {}

  async create(input: { userId: string; purpose: AccountActionPurpose; tokenHash: string; expiresAt: Date; createdBy: string }): Promise<void> {
    await this.executor.query(
      `INSERT INTO account_action_tokens (user_id, purpose, token_hash, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [input.userId, input.purpose, input.tokenHash, input.expiresAt, input.createdBy]
    );
  }

  async consume(tokenHash: string, now: Date): Promise<{ userId: string; purpose: AccountActionPurpose } | null> {
    const result = await this.executor.query<{ user_id: string; purpose: AccountActionPurpose }>(
      `UPDATE account_action_tokens SET consumed_at = $2
       WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > $2
       RETURNING user_id, purpose`, [tokenHash, now]
    );
    const row = result.rows[0];
    return row ? { userId: row.user_id, purpose: row.purpose } : null;
  }
}
