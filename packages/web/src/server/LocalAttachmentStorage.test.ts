import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LocalAttachmentStorage } from './LocalAttachmentStorage';

describe('LocalAttachmentStorage', () => {
  it('stores, reads and deletes content inside its root', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'dashboard-attachments-'));
    try {
      const storage = new LocalAttachmentStorage(root);
      const content = new TextEncoder().encode('attachment');
      const stored = await storage.put('entity/resource/file.txt', content);

      expect(stored.sizeBytes).toBe(content.byteLength);
      expect(stored.checksum).toHaveLength(64);
      expect(await storage.get(stored.storageKey)).toEqual(content);

      await storage.delete(stored.storageKey);
      expect(await storage.get(stored.storageKey)).toBeNull();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects path traversal keys', async () => {
    const storage = new LocalAttachmentStorage('/tmp/dashboard-attachment-test');
    await expect(storage.put('../outside.txt', new Uint8Array([1]))).rejects.toThrow('Invalid attachment storage key');
  });

  it('encrypts contents at rest and decrypts them with the same key', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'dashboard-attachments-'));
    try {
      const storage = new LocalAttachmentStorage(root, '11'.repeat(32));
      const content = new TextEncoder().encode('secret content');
      await storage.put('secure/file.bin', content);
      const { readFile } = await import('node:fs/promises');
      expect(await readFile(path.join(root, 'secure/file.bin'), 'utf8')).not.toContain('secret content');
      await expect(storage.get('secure/file.bin')).resolves.toEqual(content);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects invalid encryption keys', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'dashboard-attachments-'));
    expect(() => new LocalAttachmentStorage(root, 'bad-key')).toThrow('32-byte hex key');
    await rm(root, { recursive: true, force: true });
  });
});
