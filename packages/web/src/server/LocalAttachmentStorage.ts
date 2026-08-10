import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { AttachmentStoragePort, StoredAttachment } from '@dashboard/core';

export class LocalAttachmentStorage implements AttachmentStoragePort {
  private readonly encryptionKey?: Buffer;
  private readonly encryptionHeader = Buffer.from('DASHATT1');

  constructor(private readonly rootDirectory: string = process.env.ATTACHMENTS_ROOT ?? path.join(process.cwd(), '.data', 'attachments'), encryptionKeyHex = process.env.ATTACHMENTS_ENCRYPTION_KEY) {
    if (encryptionKeyHex) {
      if (!/^[0-9a-f]{64}$/i.test(encryptionKeyHex)) throw new Error('ATTACHMENTS_ENCRYPTION_KEY must be a 32-byte hex key');
      this.encryptionKey = Buffer.from(encryptionKeyHex, 'hex');
    } else if (process.env.ATTACHMENTS_REQUIRE_ENCRYPTION === 'true') {
      throw new Error('Attachment encryption is required but ATTACHMENTS_ENCRYPTION_KEY is missing');
    }
  }

  async put(storageKey: string, content: Uint8Array, options?: { encrypt?: boolean }): Promise<StoredAttachment> {
    const target = this.safePath(storageKey);
    await mkdir(path.dirname(target), { recursive: true });
    await mkdir(this.rootDirectory, { recursive: true, mode: 0o700 });
    const shouldEncrypt = options?.encrypt ?? Boolean(this.encryptionKey);
    if (shouldEncrypt && !this.encryptionKey) throw new Error('Attachment encryption requested but key is missing');
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

  private safePath(storageKey: string): string {
    const root = path.resolve(this.rootDirectory);
    const target = path.resolve(root, storageKey);
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error('Invalid attachment storage key');
    return target;
  }

  private encrypt(content: Uint8Array, enabled: boolean): Buffer {
    if (!enabled || !this.encryptionKey) return Buffer.from(content);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(content), cipher.final()]);
    return Buffer.concat([this.encryptionHeader, iv, cipher.getAuthTag(), encrypted]);
  }

  private decrypt(content: Uint8Array): Uint8Array {
    const payload = Buffer.from(content);
    if (!payload.subarray(0, this.encryptionHeader.length).equals(this.encryptionHeader)) return content;
    if (!this.encryptionKey || payload.length < 36) throw new Error('Encrypted attachment cannot be decrypted');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, payload.subarray(8, 20));
    decipher.setAuthTag(payload.subarray(20, 36));
    return new Uint8Array(Buffer.concat([decipher.update(payload.subarray(36)), decipher.final()]));
  }
}
