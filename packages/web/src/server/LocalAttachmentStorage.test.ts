/** Verifies local attachment envelopes, key rotation and path safety. */
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

  it('wraps new plaintext attachments so user content cannot collide with encryption headers', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'dashboard-attachments-'));
    try {
      const storage = new LocalAttachmentStorage(root, '11'.repeat(32));
      const content = new TextEncoder().encode('DASHATT1 user content');
      await storage.put('plain/file.bin', content, { encrypt: false });
      const { readFile } = await import('node:fs/promises');
      const stored = await readFile(path.join(root, 'plain/file.bin'));

      expect(stored.subarray(0, 8).toString()).toBe('DASHRAW1');
      await expect(storage.get('plain/file.bin')).resolves.toEqual(content);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects attachments without an explicit envelope', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'dashboard-attachments-'));
    try {
      const storage = new LocalAttachmentStorage(root, '11'.repeat(32));
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(path.join(root, 'legacy'), { recursive: true });
      const plaintext = new TextEncoder().encode('unversioned plaintext');
      await writeFile(path.join(root, 'legacy/plain.bin'), plaintext);
      await expect(storage.get('legacy/plain.bin')).rejects.toThrow('Invalid attachment format');

      const obsoleteHeader = Buffer.from('DASHATT1 invalid payload');
      await writeFile(path.join(root, 'legacy/encrypted.bin'), obsoleteHeader);
      await expect(storage.get('legacy/encrypted.bin')).rejects.toThrow('Invalid attachment format');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects invalid encryption keys', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'dashboard-attachments-'));
    expect(() => new LocalAttachmentStorage(root, 'bad-key')).toThrow('32-byte hex key');
    await rm(root, { recursive: true, force: true });
  });

  it('rotates plaintext and encrypted envelopes to the active key version', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'dashboard-attachments-'));
    const firstKey = '11'.repeat(32);
    const secondKey = '22'.repeat(32);
    const keyring = `v1=${firstKey},v2=${secondKey}`;
    try {
      const initial = new LocalAttachmentStorage(root, undefined, keyring, 'v1');
      const plaintext = new TextEncoder().encode('plain content');
      const encrypted = new TextEncoder().encode('encrypted content');
      await initial.put('plain/file.bin', plaintext, { encrypt: false });
      await initial.put('encrypted/file.bin', encrypted, { encrypt: true });

      const rotated = new LocalAttachmentStorage(root, undefined, keyring, 'v2');
      await expect(rotated.rotate('plain/file.bin')).resolves.toBe(true);
      await expect(rotated.rotate('encrypted/file.bin')).resolves.toBe(true);
      await expect(rotated.rotate('encrypted/file.bin')).resolves.toBe(false);
      await expect(rotated.get('plain/file.bin')).resolves.toEqual(plaintext);
      await expect(rotated.get('encrypted/file.bin')).resolves.toEqual(encrypted);

      const { readFile } = await import('node:fs/promises');
      const rotatedPlain = await readFile(path.join(root, 'plain/file.bin'));
      const rotatedEncrypted = await readFile(path.join(root, 'encrypted/file.bin'));
      expect(rotatedPlain.subarray(0, 8).toString()).toBe('DASHATT2');
      expect(rotatedEncrypted.subarray(0, 8).toString()).toBe('DASHATT2');
      expect(rotatedEncrypted.subarray(9, 11).toString()).toBe('v2');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
