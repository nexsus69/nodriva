/** Reads and sanitizes optional backup evidence exposed by the current deployment. */
import { readFile } from 'node:fs/promises';
import type { BackupStatusPort, PublicBackupStatus } from '@dashboard/core';

type BackupManifest = Record<string, unknown>;

function isRecord(value: unknown): value is BackupManifest {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown, pattern?: RegExp): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 && (!pattern || pattern.test(value))
    ? value
    : undefined;
}

function optionalPositiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function recoveryDependencies(value: unknown): PublicBackupStatus['recoveryDependencies'] | undefined {
  if (!isRecord(value)) return undefined;
  const attachmentPayloads = value.attachmentPayloads;
  const encryptionKeyring = value.encryptionKeyring;
  return {
    ...(attachmentPayloads === 'coordinated-copy-required' || attachmentPayloads === 'not-configured' ? { attachmentPayloads } : {}),
    ...(encryptionKeyring === 'deployment-secret-required' || encryptionKeyring === 'not-configured' ? { encryptionKeyring } : {}),
  };
}

/** Makes a local operational manifest available only as the restricted Administration read model. */
export class BackupStatusFileReader implements BackupStatusPort {
  constructor(private readonly statusFile?: string) {}

  async read(): Promise<PublicBackupStatus> {
    if (!this.statusFile) return { status: 'unavailable', code: 'status_not_configured' };
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(this.statusFile, 'utf8'));
    } catch {
      return { status: 'unavailable', code: 'status_unavailable' };
    }
    if (!isRecord(parsed) || !['completed', 'paused', 'failed'].includes(String(parsed.status))) {
      return { status: 'unavailable', code: 'status_invalid' };
    }
    const completedAt = optionalString(parsed.completedAt);
    return {
      status: parsed.status as Extract<PublicBackupStatus['status'], 'completed' | 'paused' | 'failed'>,
      ...(optionalString(parsed.provider, /^[a-z0-9-]+$/) ? { providerKey: optionalString(parsed.provider, /^[a-z0-9-]+$/) } : {}),
      ...(completedAt && !Number.isNaN(Date.parse(completedAt)) ? { completedAt } : {}),
      ...(optionalString(parsed.checksum, /^[a-f0-9]+$/i) ? { checksum: optionalString(parsed.checksum, /^[a-f0-9]+$/i) } : {}),
      ...(optionalPositiveInteger(parsed.sizeBytes) !== undefined ? { sizeBytes: optionalPositiveInteger(parsed.sizeBytes) } : {}),
      ...(optionalPositiveInteger(parsed.schemaVersion) !== undefined ? { schemaVersion: optionalPositiveInteger(parsed.schemaVersion) } : {}),
      ...(parsed.restoreVerification === 'passed' || parsed.restoreVerification === 'not-run' ? { restoreVerification: parsed.restoreVerification } : {}),
      ...(recoveryDependencies(parsed.recoveryDependencies) ? { recoveryDependencies: recoveryDependencies(parsed.recoveryDependencies) } : {}),
    };
  }
}
