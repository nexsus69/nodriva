/** Coordinates durable, idempotent cleanup of unowned attachment blobs. */
import { randomUUID } from 'node:crypto';
import type { AttachmentCleanupPort } from '../ports/AttachmentCleanupPort.js';
import type { AttachmentStoragePort } from '../ports/AttachmentStoragePort.js';

export const ATTACHMENT_UPLOAD_STAGING_MS = 10 * 60_000;

export class AttachmentCleanupService {
  constructor(
    private readonly queue: AttachmentCleanupPort,
    private readonly storage: AttachmentStoragePort,
    private readonly workerId = `attachment-cleanup:${process.env.HOSTNAME ?? 'worker'}:${process.pid}:${randomUUID()}`,
    private readonly now: () => Date = () => new Date(),
  ) {}

  scheduleUploadStaging(storageKey: string): Promise<void> {
    return this.queue.schedule(storageKey, new Date(this.now().getTime() + ATTACHMENT_UPLOAD_STAGING_MS));
  }

  cancel(storageKey: string): Promise<void> { return this.queue.cancel(storageKey); }
  scheduleDeletion(storageKey: string): Promise<void> { return this.queue.schedule(storageKey, this.now()); }

  async drain(limit = 100): Promise<number> {
    const pending = await this.queue.claimPending(this.workerId, limit);
    for (const item of pending) {
      try {
        await this.storage.delete(item.storageKey);
        await this.queue.markCompleted(item.storageKey, this.workerId);
      } catch (error) {
        await this.queue.markFailed(item.storageKey, this.workerId, error instanceof Error ? error.message : String(error));
      }
    }
    return pending.length;
  }
}
