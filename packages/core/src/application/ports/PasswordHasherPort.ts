/** Cryptographic password operations supplied by the runtime composition root. */
export interface PasswordHasherPort {
  hash(password: string): string;
  verify(password: string, storedHash: string): boolean;
  verifyAsync(password: string, storedHash?: string): Promise<boolean>;
}
