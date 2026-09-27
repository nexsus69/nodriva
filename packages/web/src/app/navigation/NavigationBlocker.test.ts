/** Verifies the shared registry used to protect unsaved work during navigation. */
import { describe, expect, it } from 'vitest';
import { NavigationBlockerRegistry } from './NavigationBlocker';

describe('NavigationBlockerRegistry', () => {
  it('tracks multiple independent drafts until all of them are cleared', () => {
    const registry = new NavigationBlockerRegistry();

    expect(registry.setBlocked('node-editor', true)).toBe(true);
    expect(registry.setBlocked('entity-editor', true)).toBe(true);
    expect(registry.isBlocked).toBe(true);

    expect(registry.setBlocked('node-editor', false)).toBe(true);
    expect(registry.isBlocked).toBe(true);

    expect(registry.setBlocked('entity-editor', false)).toBe(true);
    expect(registry.isBlocked).toBe(false);
  });

  it('clears every draft only after a confirmed navigation decision', () => {
    const registry = new NavigationBlockerRegistry();
    const discarded: string[] = [];
    registry.setBlocked('node-editor', true, () => discarded.push('node-editor'));
    registry.setBlocked('entity-editor', true, () => discarded.push('entity-editor'));

    expect(registry.clear()).toBe(true);
    expect(registry.isBlocked).toBe(false);
    expect(discarded).toEqual(['node-editor', 'entity-editor']);
    expect(registry.clear()).toBe(false);
  });
});
