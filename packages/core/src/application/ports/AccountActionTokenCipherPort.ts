/** Encrypts the short-lived token while it is held by the delivery outbox. */
export interface AccountActionTokenCipherPort {
  encrypt(token: string): string;
  decrypt(ciphertext: string): string;
}
