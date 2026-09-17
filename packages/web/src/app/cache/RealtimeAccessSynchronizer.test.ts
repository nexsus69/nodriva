import { describe, expect, it, vi } from 'vitest';
import {
  RealtimeAccessSynchronizer,
  type RealtimeAccessSynchronizerOptions,
} from './RealtimeAccessSynchronizer';

function createOptions(): RealtimeAccessSynchronizerOptions {
  return {
    load: vi.fn(async () => ({ kind: 'authorized' as const, snapshot: {
      dataChannels: ['data-a'], lockChannels: ['lock-a'], virtualRootNodeIds: ['node-1'], realtimeEnabled: true,
      realtimeCheckpoints: [],
    } })),
    onUnauthorized: vi.fn(), onContinuityUnknown: vi.fn(), setRealtimeEnabled: vi.fn(), observeChannels: vi.fn(),
    observeCheckpoints: vi.fn(), retainChannels: vi.fn(() => vi.fn()), setVirtualRootNodeIds: vi.fn(),
    isReadModelLive: vi.fn(() => true),
  };
}

describe('RealtimeAccessSynchronizer', () => {
  it('deduplicates concurrent access synchronization and retains the authorized channel policy once', async () => {
    const options = createOptions();
    const synchronizer = new RealtimeAccessSynchronizer(options);

    await expect(Promise.all([synchronizer.synchronize(), synchronizer.synchronize()])).resolves.toEqual([true, true]);

    expect(options.load).toHaveBeenCalledOnce();
    expect(options.retainChannels).toHaveBeenCalledWith(['data-a'], ['lock-a']);
    expect(options.setVirtualRootNodeIds).toHaveBeenCalledWith(['node-1']);
  });

  it('releases a prior subscription when an authorized policy changes', async () => {
    const options = createOptions();
    const firstRelease = vi.fn();
    vi.mocked(options.retainChannels)
      .mockReturnValueOnce(firstRelease)
      .mockReturnValueOnce(vi.fn());
    vi.mocked(options.load)
      .mockResolvedValueOnce({ kind: 'authorized', snapshot: {
        dataChannels: ['data-a'], lockChannels: [], virtualRootNodeIds: [], realtimeEnabled: true, realtimeCheckpoints: [],
      } })
      .mockResolvedValueOnce({ kind: 'authorized', snapshot: {
        dataChannels: ['data-b'], lockChannels: [], virtualRootNodeIds: [], realtimeEnabled: true, realtimeCheckpoints: [],
      } });
    const synchronizer = new RealtimeAccessSynchronizer(options);

    await synchronizer.synchronize();
    await synchronizer.synchronize();

    expect(firstRelease).toHaveBeenCalledOnce();
  });

  it('purges the browser session after an unauthorized access response', async () => {
    const options = createOptions();
    vi.mocked(options.load).mockResolvedValue({ kind: 'unauthorized' });
    const synchronizer = new RealtimeAccessSynchronizer(options);

    await expect(synchronizer.synchronize()).resolves.toBe(false);

    expect(options.onUnauthorized).toHaveBeenCalledOnce();
  });
});
