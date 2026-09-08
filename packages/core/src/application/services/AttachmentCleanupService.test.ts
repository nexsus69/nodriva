/** Verifies durable staging and retry orchestration for attachment cleanup. */
import { describe, expect, it, vi } from 'vitest';
import type { AttachmentCleanupPort } from '../ports/AttachmentCleanupPort.js';
import type { AttachmentStoragePort } from '../ports/AttachmentStoragePort.js';
import { ATTACHMENT_UPLOAD_STAGING_MS, AttachmentCleanupService } from './AttachmentCleanupService.js';

describe('AttachmentCleanupService', () => {
  it('delays upload staging and makes committed deletion immediately claimable', async () => {
    const queue: AttachmentCleanupPort = {
      schedule: vi.fn(), cancel: vi.fn(), claimPending: vi.fn(), markCompleted: vi.fn(), markFailed: vi.fn(),
    };
    const storage = { delete: vi.fn() } as unknown as AttachmentStoragePort;
    const now = new Date('2026-09-08T10:00:00.000Z');
    const service = new AttachmentCleanupService(queue, storage, 'worker', () => now);

    await service.scheduleUploadStaging('staged');
    expect(queue.schedule).toHaveBeenCalledWith('staged', new Date(now.getTime() + ATTACHMENT_UPLOAD_STAGING_MS));
    await service.scheduleDeletion('deleted');
    expect(queue.schedule).toHaveBeenCalledWith('deleted', now);
  });

  it('completes deleted blobs and retains failures for retry', async () => {
    const queue: AttachmentCleanupPort = {
      schedule: vi.fn(),
      cancel: vi.fn(),
      claimPending: vi.fn().mockResolvedValue([{ storageKey: 'ok' }, { storageKey: 'failed' }]),
      markCompleted: vi.fn(),
      markFailed: vi.fn(),
    };
    const storage = {
      delete: vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('disk busy')),
    } as unknown as AttachmentStoragePort;
    const service = new AttachmentCleanupService(queue, storage, 'worker');

    await expect(service.drain()).resolves.toBe(2);
    expect(queue.markCompleted).toHaveBeenCalledWith('ok', 'worker');
    expect(queue.markFailed).toHaveBeenCalledWith('failed', 'worker', 'disk busy');
  });
});
