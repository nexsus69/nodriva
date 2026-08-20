import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobalViewStore } from './ViewStore';
import { subscribeSemanticViewState } from './semanticViewSubscription';

describe('subscribeSemanticViewState', () => {
  beforeEach(() => GlobalViewStore.purge());

  it('does not treat the initial miss as invalidation but reacts to later eviction', () => {
    const invalidated = vi.fn();
    const unsubscribe = subscribeSemanticViewState('BREADCRUMB|baseNodeId:child', vi.fn(), invalidated);

    expect(invalidated).not.toHaveBeenCalled();
    GlobalViewStore.set('BREADCRUMB|baseNodeId:child', {
      viewKey: 'BREADCRUMB|baseNodeId:child',
      pages: [],
      status: 'success',
      error: null,
      satisfactionStatus: 'satisfied',
      updatedAt: Date.now(),
    });
    GlobalViewStore.delete('BREADCRUMB|baseNodeId:child');

    expect(invalidated).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
