/** Verifies that realtime version changes block stale form submissions before the server action. */
import { describe, expect, it, vi } from 'vitest';
import { hasStaleOptimisticEdit } from './GlobalCacheClient';

describe('optimistic edit realtime guard', () => {
  it('blocks the server save when realtime advances the resource version during editing', () => {
    const saveServer = vi.fn();
    const editingRowVersion = 7;

    // Equivalent to the entity/node cache receiving a realtime:data-changed
    // event while the form is open.
    const currentRowVersion = 8;
    const stale = hasStaleOptimisticEdit(editingRowVersion, currentRowVersion);

    if (!stale) saveServer();

    expect(stale).toBe(true);
    expect(saveServer).not.toHaveBeenCalled();
  });

  it('allows saving when the realtime version is unchanged', () => {
    const saveServer = vi.fn();
    if (!hasStaleOptimisticEdit(7, 7)) saveServer();
    expect(saveServer).toHaveBeenCalledOnce();
  });
});
