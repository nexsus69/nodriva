/** Defines the redacted recovery evidence that an administrative view may consume. */
export type BackupRecoveryStatus = 'completed' | 'paused' | 'failed' | 'unavailable';

export interface PublicBackupStatus {
  status: BackupRecoveryStatus;
  providerKey?: string;
  completedAt?: string;
  checksum?: string;
  sizeBytes?: number;
  schemaVersion?: number;
  restoreVerification?: 'passed' | 'not-run';
  recoveryDependencies?: Readonly<{
    attachmentPayloads?: 'coordinated-copy-required' | 'not-configured';
    encryptionKeyring?: 'deployment-secret-required' | 'not-configured';
  }>;
  /** Stable client-safe reason for a status that is not completed. */
  code?: 'status_not_configured' | 'status_unavailable' | 'status_invalid';
}

/** Reads backup evidence produced by an operational provider without executing backup or restore. */
export interface BackupStatusPort {
  read(): Promise<PublicBackupStatus>;
}
