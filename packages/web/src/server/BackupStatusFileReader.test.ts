/** Verifies that recovery evidence is redacted and unavailable states never leak file details. */
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BackupStatusFileReader } from './BackupStatusFileReader';

describe('BackupStatusFileReader', () => {
  it('returns only the public fields from a verified operational manifest', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'dashboard-backup-status-'));
    const statusFile = path.join(directory, 'last-status.json');
    await writeFile(statusFile, JSON.stringify({
      status: 'completed', provider: 'sqlite-snapshot', completedAt: '2026-09-02T10:00:00.000Z',
      checksum: 'a'.repeat(64), sizeBytes: 1234, schemaVersion: 7, restoreVerification: 'passed',
      backupFile: '/private/backups/dashboard.sqlite', recoveryDependencies: {
        attachmentPayloads: 'coordinated-copy-required', encryptionKeyring: 'deployment-secret-required',
      },
    }));

    await expect(new BackupStatusFileReader(statusFile).read()).resolves.toEqual({
      status: 'completed', providerKey: 'sqlite-snapshot', completedAt: '2026-09-02T10:00:00.000Z',
      checksum: 'a'.repeat(64), sizeBytes: 1234, schemaVersion: 7, restoreVerification: 'passed',
      recoveryDependencies: { attachmentPayloads: 'coordinated-copy-required', encryptionKeyring: 'deployment-secret-required' },
    });
  });

  it('represents a missing optional status source as unavailable', async () => {
    await expect(new BackupStatusFileReader().read()).resolves.toEqual({ status: 'unavailable', code: 'status_not_configured' });
    await expect(new BackupStatusFileReader('/does/not/exist').read()).resolves.toEqual({ status: 'unavailable', code: 'status_unavailable' });
  });
});
