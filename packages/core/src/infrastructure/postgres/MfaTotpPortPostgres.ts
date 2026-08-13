import type { MfaTotpPort, MfaTotpRecord } from '../../application/ports/MfaTotpPort.js';
import type { PgExecutor } from './PgExecutor.js';

export class MfaTotpPortPostgres implements MfaTotpPort {
  constructor(private readonly executor: PgExecutor) {}

  async findByUserId(userId: string): Promise<MfaTotpRecord | null> {
    const result = await this.executor.query<{
      user_id: string;
      secret_ciphertext: string;
      enabled_at: Date | null;
      recovery_code_hashes: string[];
    }>(
      `SELECT user_id, secret_ciphertext, enabled_at, recovery_code_hashes
       FROM user_mfa_totp WHERE user_id = $1`,
      [userId],
    );
    const row = result.rows[0];
    return row ? {
      userId: row.user_id,
      secretCiphertext: row.secret_ciphertext,
      enabledAt: row.enabled_at,
      recoveryCodeHashes: row.recovery_code_hashes,
    } : null;
  }

  async savePending(userId: string, secretCiphertext: string): Promise<void> {
    await this.executor.query(
      `INSERT INTO user_mfa_totp (user_id, secret_ciphertext, enabled_at, recovery_code_hashes, updated_at)
       VALUES ($1, $2, NULL, '[]'::jsonb, NOW())
       ON CONFLICT (user_id) DO UPDATE SET secret_ciphertext = EXCLUDED.secret_ciphertext,
         enabled_at = NULL, recovery_code_hashes = '[]'::jsonb, updated_at = NOW()`,
      [userId, secretCiphertext],
    );
  }

  async enable(userId: string, recoveryCodeHashes: string[], enabledAt: Date): Promise<void> {
    await this.executor.query(
      `UPDATE user_mfa_totp SET enabled_at = $2, recovery_code_hashes = $3::jsonb, updated_at = $2
       WHERE user_id = $1`,
      [userId, enabledAt, JSON.stringify(recoveryCodeHashes)],
    );
  }

  async consumeRecoveryCode(userId: string, recoveryCodeHash: string): Promise<boolean> {
    const result = await this.executor.query(
      `UPDATE user_mfa_totp
       SET recovery_code_hashes = recovery_code_hashes - $2, updated_at = NOW()
       WHERE user_id = $1 AND enabled_at IS NOT NULL AND recovery_code_hashes ? $2
       RETURNING user_id`,
      [userId, recoveryCodeHash],
    );
    return result.rowCount === 1;
  }

  async deleteForUser(userId: string): Promise<void> {
    await this.executor.query('DELETE FROM user_mfa_totp WHERE user_id = $1', [userId]);
  }
}
