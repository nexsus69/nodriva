export interface MfaTotpRecord {
  userId: string;
  secretCiphertext: string;
  enabledAt: Date | null;
  recoveryCodeHashes: string[];
}

export interface MfaTotpPort {
  findByUserId(userId: string): Promise<MfaTotpRecord | null>;
  savePending(userId: string, secretCiphertext: string): Promise<void>;
  enable(userId: string, recoveryCodeHashes: string[], enabledAt: Date): Promise<void>;
  consumeRecoveryCode(userId: string, recoveryCodeHash: string): Promise<boolean>;
  deleteForUser(userId: string): Promise<void>;
}
