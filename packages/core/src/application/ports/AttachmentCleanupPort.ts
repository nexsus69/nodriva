export interface PendingAttachmentCleanup {
  storageKey: string;
}

/** Durable cleanup queue for blobs that no longer have a live database owner. */
export interface AttachmentCleanupPort {
  schedule(storageKey: string, notBefore: Date): Promise<void>;
  cancel(storageKey: string): Promise<void>;
  claimPending(workerId: string, limit: number): Promise<PendingAttachmentCleanup[]>;
  markCompleted(storageKey: string, workerId: string): Promise<void>;
  markFailed(storageKey: string, workerId: string, error: string): Promise<void>;
}
