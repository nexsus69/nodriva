import { describe, expect, it } from 'vitest';
import { VirtualRootStore } from './VirtualRootStore';

describe('VirtualRootStore', () => {
  it('replaces the authorized root set without retaining revoked roots', () => {
    const store = new VirtualRootStore();
    store.replace(['node-1', 'node-2']);
    store.replace(['node-2', 'node-3']);

    expect(store.has('node-1')).toBe(false);
    expect(store.has('node-2')).toBe(true);
    expect(store.has('node-3')).toBe(true);
  });

  it('clears the authorized roots at a read-model boundary', () => {
    const store = new VirtualRootStore();
    store.replace(['node-1']);

    store.clear();

    expect(store.has('node-1')).toBe(false);
  });
});
