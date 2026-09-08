/** Verifies encrypted persistence envelopes for account action tokens. */
import { describe, expect, it } from 'vitest';
import { AccountActionTokenCipherAesGcm } from './AccountActionTokenCipherAesGcm.js';

describe('AccountActionTokenCipherAesGcm', () => {
  it('keeps recovery tokens unreadable at rest and decrypts with the configured key', () => {
    const cipher = new AccountActionTokenCipherAesGcm('11'.repeat(32));
    const encrypted = cipher.encrypt('recovery-token');
    expect(encrypted).not.toContain('recovery-token');
    expect(cipher.decrypt(encrypted)).toBe('recovery-token');
  });

  it('fails closed for malformed or tampered ciphertext', () => {
    const cipher = new AccountActionTokenCipherAesGcm('11'.repeat(32));
    expect(() => cipher.decrypt('invalid')).toThrow('Invalid account action token ciphertext');
    expect(() => cipher.decrypt(`${cipher.encrypt('token')}x`)).toThrow('Invalid account action token ciphertext');
  });
});
