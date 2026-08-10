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
});
