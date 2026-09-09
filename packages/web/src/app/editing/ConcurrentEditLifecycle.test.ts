import { describe, expect, it } from 'vitest';
import {
  abandonConcurrentEdit,
  acceptConcurrentEditVersion,
  beginConcurrentEdit,
  canSubmitConcurrentEdit,
  reconcileConcurrentEdit,
} from './ConcurrentEditLifecycle';

describe('ConcurrentEditLifecycle', () => {
  it('blocks a draft after an external revision while preserving its baseline for an explicit reload', () => {
    const editing = beginConcurrentEdit(4);
    const stale = reconcileConcurrentEdit(editing, {
      ownsLock: true, currentRowVersion: 5, mutationPending: false, currentVersionIsLocal: false,
    });

    expect(stale).toEqual({ baselineRowVersion: 4, stale: true });
    expect(canSubmitConcurrentEdit(stale, 5)).toBe(false);
    expect(acceptConcurrentEditVersion(5)).toEqual({ baselineRowVersion: 5, stale: false });
  });

  it('does not mistake the local optimistic revision for a concurrent update', () => {
    const next = reconcileConcurrentEdit(beginConcurrentEdit(4), {
      ownsLock: true, currentRowVersion: 5, mutationPending: true, currentVersionIsLocal: true,
    });

    expect(next).toEqual({ baselineRowVersion: 4, stale: false });
    expect(abandonConcurrentEdit()).toEqual({ baselineRowVersion: null, stale: false });
  });
});
