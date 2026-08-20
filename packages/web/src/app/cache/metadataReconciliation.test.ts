import { describe, expect, it, vi } from 'vitest';
import { reconcileMetadataBestEffort } from './metadataReconciliation';

describe('reconcileMetadataBestEffort', () => {
  it('observes an operational failure without rejecting the caller', async () => {
    const error = new Error('metadata endpoint unavailable');
    const report = vi.fn();

    expect(reconcileMetadataBestEffort(async () => { throw error; }, 'visibility sync', report)).toBeUndefined();
    await vi.waitFor(() => expect(report).toHaveBeenCalledWith(
      '[MetadataReconciliation] visibility sync failed:',
      error,
    ));
  });

  it('does not report a successful reconciliation', async () => {
    const report = vi.fn();
    reconcileMetadataBestEffort(async () => undefined, 'polling', report);
    await Promise.resolve();
    await Promise.resolve();
    expect(report).not.toHaveBeenCalled();
  });
});
