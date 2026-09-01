import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { EncryptionKeyring } from '@dashboard/core';

/** Shared envelope format for attachment backends; storage transports never decide encryption policy. */
export class AttachmentContentCryptor {
  private readonly keyring: EncryptionKeyring;
  private readonly header = Buffer.from('DASHATT2');

  constructor(key?: string, keyring?: string, activeVersion = 'v1', requireEncryption = false) {
    this.keyring = new EncryptionKeyring(key, keyring, activeVersion, 'ATTACHMENTS_ENCRYPTION_KEY');
    if (!this.keyring.hasKeys && requireEncryption) throw new Error('Attachment encryption is required but ATTACHMENTS_ENCRYPTION_KEY is missing');
  }

  encrypt(content: Uint8Array, enabled: boolean): Buffer {
    if (!enabled || !this.keyring.hasKeys) return Buffer.from(content);
    const iv = randomBytes(12);
    const activeKey = this.keyring.active();
    const version = Buffer.from(activeKey.version, 'utf8');
    if (version.length > 255) throw new Error('Attachment encryption key version is too long');
    const cipher = createCipheriv('aes-256-gcm', activeKey.value, iv);
    const encrypted = Buffer.concat([cipher.update(content), cipher.final()]);
    return Buffer.concat([this.header, Buffer.from([version.length]), version, iv, cipher.getAuthTag(), encrypted]);
  }

  decrypt(content: Uint8Array): Uint8Array {
    const payload = Buffer.from(content);
    if (!payload.subarray(0, this.header.length).equals(this.header)) return content;
    const versionLength = payload[8];
    const versionStart = 9;
    const ivStart = versionStart + versionLength;
    if (!versionLength || payload.length < ivStart + 28) throw new Error('Invalid encrypted attachment format');
    const decipher = createDecipheriv('aes-256-gcm', this.keyring.get(payload.subarray(versionStart, ivStart).toString('utf8')), payload.subarray(ivStart, ivStart + 12));
    decipher.setAuthTag(payload.subarray(ivStart + 12, ivStart + 28));
    return new Uint8Array(Buffer.concat([decipher.update(payload.subarray(ivStart + 28)), decipher.final()]));
  }
}
