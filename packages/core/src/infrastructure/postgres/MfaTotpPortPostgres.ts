/** Persists active and expiring pending TOTP factors in PostgreSQL. */
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
      pending_secret_ciphertext: string | null;
      pending_expires_at: Date | null;
    }>(
      `SELECT user_id, secret_ciphertext, enabled_at, recovery_code_hashes, pending_secret_ciphertext, pending_expires_at
       FROM user_mfa_totp WHERE user_id = $1`,
      [userId],
    );
    const row = result.rows[0];
    return row ? {
      userId: row.user_id,
      secretCiphertext: row.secret_ciphertext,
      enabledAt: row.enabled_at,
      recoveryCodeHashes: row.recovery_code_hashes,
      pendingSecretCiphertext: row.pending_secret_ciphertext,
      pendingExpiresAt: row.pending_expires_at,
    } : null;
  }

  async savePending(userId: string, secretCiphertext: string, expiresAt: Date): Promise<void> {
    await this.executor.query(
      `INSERT INTO user_mfa_totp (user_id, secret_ciphertext, enabled_at, recovery_code_hashes, pending_secret_ciphertext, pending_expires_at, updated_at)
       VALUES ($1, $2, NULL, '[]'::jsonb, $2, $3, NOW())
       ON CONFLICT (user_id) DO UPDATE SET pending_secret_ciphertext = EXCLUDED.pending_secret_ciphertext,
         pending_expires_at = EXCLUDED.pending_expires_at, updated_at = NOW()`,
      [userId, secretCiphertext, expiresAt],
    );
  }

  async promotePending(userId: string, recoveryCodeHashes: string[], enabledAt: Date): Promise<boolean> {
    const result = await this.executor.query(
      `UPDATE user_mfa_totp SET secret_ciphertext = pending_secret_ciphertext, enabled_at = $2,
         recovery_code_hashes = $3::jsonb, pending_secret_ciphertext = NULL, pending_expires_at = NULL, updated_at = $2
       WHERE user_id = $1 AND pending_secret_ciphertext IS NOT NULL AND pending_expires_at > $2`,
      [userId, enabledAt, JSON.stringify(recoveryCodeHashes)],
    );
    return result.rowCount === 1;
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
