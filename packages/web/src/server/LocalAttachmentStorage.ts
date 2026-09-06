/** Provides local attachment persistence with explicit plaintext and encrypted envelopes. */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { AttachmentStoragePort, StoredAttachment } from '@dashboard/core';
import { EncryptionKeyring } from '@dashboard/core';

export class LocalAttachmentStorage implements AttachmentStoragePort {
  private readonly rootDirectory: string;
  private readonly plaintextHeader = Buffer.from('DASHRAW1');
  private readonly keyring: EncryptionKeyring;
  private readonly encryptionHeader = Buffer.from('DASHATT1');
  private readonly versionedEncryptionHeader = Buffer.from('DASHATT2');

  constructor(rootDirectory: string = path.join(process.cwd(), '.data', 'attachments'), encryptionKeyHex?: string, keyringSpec?: string, activeVersion = 'v1', requireEncryption = false) {
    this.rootDirectory = rootDirectory;
    this.keyring = new EncryptionKeyring(encryptionKeyHex, keyringSpec, activeVersion, 'ATTACHMENTS_ENCRYPTION_KEY');
    if (!this.keyring.hasKeys && requireEncryption) {
      throw new Error('Attachment encryption is required but ATTACHMENTS_ENCRYPTION_KEY is missing');
    }
  }

  async put(storageKey: string, content: Uint8Array, options?: { encrypt?: boolean }): Promise<StoredAttachment> {
    const target = this.safePath(storageKey);
    await mkdir(path.dirname(target), { recursive: true });
    await mkdir(this.rootDirectory, { recursive: true, mode: 0o700 });
    const shouldEncrypt = options?.encrypt ?? this.keyring.hasKeys;
    if (shouldEncrypt && !this.keyring.hasKeys) throw new Error('Attachment encryption requested but key is missing');
    const payload = this.encrypt(content, shouldEncrypt);
    await writeFile(target, payload, { mode: 0o600, flag: 'wx' });
    return { storageKey, checksum: createHash('sha256').update(content).digest('hex'), sizeBytes: content.byteLength };
  }

  async get(storageKey: string): Promise<Uint8Array | null> {
    try {
      return this.decrypt(new Uint8Array(await readFile(this.safePath(storageKey))));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async delete(storageKey: string): Promise<void> {
    try {
      await unlink(this.safePath(storageKey));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  async rotate(storageKey: string): Promise<boolean> {
    if (!this.keyring.hasKeys) throw new Error('Attachment encryption key is missing');
    const target = this.safePath(storageKey);
    const source = new Uint8Array(await readFile(target));
    const currentVersion = this.storedVersion(source);
    const activeVersion = this.keyring.active().version;
    if (currentVersion === activeVersion) return false;
    const plaintext = this.decrypt(source);
    const rotated = this.encrypt(plaintext, true);
    const temporary = `${target}.rotation-${process.pid}-${Date.now()}`;
    await writeFile(temporary, rotated, { mode: 0o600, flag: 'wx' });
    await (await import('node:fs/promises')).rename(temporary, target);
    return true;
  }

  private safePath(storageKey: string): string {
    const root = path.resolve(this.rootDirectory);
    const target = path.resolve(root, storageKey);
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error('Invalid attachment storage key');
    return target;
  }

  private encrypt(content: Uint8Array, enabled: boolean): Buffer {
    if (!enabled || !this.keyring.hasKeys) return Buffer.concat([this.plaintextHeader, Buffer.from(content)]);
    const iv = randomBytes(12);
    const activeKey = this.keyring.active();
    const versionBytes = Buffer.from(activeKey.version, 'utf8');
    if (versionBytes.length > 255) throw new Error('Attachment encryption key version is too long');
    const cipher = createCipheriv('aes-256-gcm', activeKey.value, iv);
    const encrypted = Buffer.concat([cipher.update(content), cipher.final()]);
    return Buffer.concat([this.versionedEncryptionHeader, Buffer.from([versionBytes.length]), versionBytes, iv, cipher.getAuthTag(), encrypted]);
  }

  private decrypt(content: Uint8Array): Uint8Array {
    const payload = Buffer.from(content);
    if (payload.subarray(0, this.plaintextHeader.length).equals(this.plaintextHeader)) {
      return new Uint8Array(payload.subarray(this.plaintextHeader.length));
    }
    if (payload.subarray(0, this.encryptionHeader.length).equals(this.encryptionHeader)) {
      if (!this.keyring.hasKeys || payload.length < 36) throw new Error('Encrypted attachment cannot be decrypted');
      const decipher = createDecipheriv('aes-256-gcm', this.keyring.get('v1'), payload.subarray(8, 20));
      decipher.setAuthTag(payload.subarray(20, 36));
      return new Uint8Array(Buffer.concat([decipher.update(payload.subarray(36)), decipher.final()]));
    }
    if (!payload.subarray(0, this.versionedEncryptionHeader.length).equals(this.versionedEncryptionHeader)) return content;
    const versionLength = payload[8];
    const versionStart = 9;
    const ivStart = versionStart + versionLength;
    if (!versionLength || payload.length < ivStart + 28) throw new Error('Invalid encrypted attachment format');
    const version = payload.subarray(versionStart, ivStart).toString('utf8');
    const decipher = createDecipheriv('aes-256-gcm', this.keyring.get(version), payload.subarray(ivStart, ivStart + 12));
    decipher.setAuthTag(payload.subarray(ivStart + 12, ivStart + 28));
    return new Uint8Array(Buffer.concat([decipher.update(payload.subarray(ivStart + 28)), decipher.final()]));
  }

  private storedVersion(content: Uint8Array): string | null {
    const payload = Buffer.from(content);
    if (payload.subarray(0, this.encryptionHeader.length).equals(this.encryptionHeader)) return 'v1';
    if (!payload.subarray(0, this.versionedEncryptionHeader.length).equals(this.versionedEncryptionHeader)) return null;
    const versionLength = payload[8];
    const versionStart = 9;
    if (!versionLength || payload.length < versionStart + versionLength) throw new Error('Invalid encrypted attachment format');
    return payload.subarray(versionStart, versionStart + versionLength).toString('utf8');
  }
}
