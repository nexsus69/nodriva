import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { AttachmentStoragePort, StoredAttachment } from '@dashboard/core';

export class LocalAttachmentStorage implements AttachmentStoragePort {
  constructor(private readonly rootDirectory: string = process.env.ATTACHMENTS_ROOT ?? path.join(process.cwd(), '.data', 'attachments')) {}

  async put(storageKey: string, content: Uint8Array): Promise<StoredAttachment> {
    const target = this.safePath(storageKey);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
    return { storageKey, checksum: createHash('sha256').update(content).digest('hex'), sizeBytes: content.byteLength };
  }

  async get(storageKey: string): Promise<Uint8Array | null> {
    try {
      return new Uint8Array(await readFile(this.safePath(storageKey)));
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
}
