/** Defines persistence operations for active and pending TOTP factors. */
export interface MfaTotpRecord {
  userId: string;
  secretCiphertext: string;
  enabledAt: Date | null;
  recoveryCodeHashes: string[];
  pendingSecretCiphertext: string | null;
  pendingExpiresAt: Date | null;
}

export interface MfaTotpPort {
  findByUserId(userId: string): Promise<MfaTotpRecord | null>;
  savePending(userId: string, secretCiphertext: string, expiresAt: Date): Promise<void>;
  promotePending(userId: string, recoveryCodeHashes: string[], enabledAt: Date): Promise<boolean>;
  consumeRecoveryCode(userId: string, recoveryCodeHash: string): Promise<boolean>;
  deleteForUser(userId: string): Promise<void>;
}
