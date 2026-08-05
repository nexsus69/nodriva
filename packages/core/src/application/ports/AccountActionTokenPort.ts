export type AccountActionPurpose = 'invitation' | 'password_reset';

export interface AccountActionTokenPort {
  create(input: { userId: string; purpose: AccountActionPurpose; tokenHash: string; expiresAt: Date; createdBy: string }): Promise<void>;
  consume(tokenHash: string, now: Date): Promise<{ userId: string; purpose: AccountActionPurpose } | null>;
}
