import crypto from 'node:crypto';
import type { AccountActionTokenCipherPort } from '../../application/ports/AccountActionTokenCipherPort.js';
import { EncryptionKeyring } from './EncryptionKeyring.js';

/** Versioned AES-256-GCM envelope for account-action tokens at rest. */
export class AccountActionTokenCipherAesGcm implements AccountActionTokenCipherPort {
  private readonly keyring: EncryptionKeyring;

  constructor(keyHex: string, keys?: string, activeVersion = 'v1') {
    this.keyring = new EncryptionKeyring(keyHex, keys, activeVersion, 'ACCOUNT_ACTION_ENCRYPTION_KEY');
  }

  encrypt(token: string): string {
    const key = this.keyring.active();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key.value, iv);
    const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    return [key.version, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
  }

  decrypt(envelope: string): string {
    const [version, ivValue, tagValue, ciphertextValue, ...rest] = envelope.split('.');
    if (!version || !ivValue || !tagValue || !ciphertextValue || rest.length) throw new Error('Invalid account action token ciphertext');
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.keyring.get(version), Buffer.from(ivValue, 'base64url'));
      decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
      return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, 'base64url')), decipher.final()]).toString('utf8');
    } catch {
      throw new Error('Invalid account action token ciphertext');
    }
  }
}
