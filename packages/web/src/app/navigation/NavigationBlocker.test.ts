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
    registry.setBlocked('node-editor', true);
    registry.setBlocked('entity-editor', true);

    expect(registry.clear()).toBe(true);
    expect(registry.isBlocked).toBe(false);
    expect(registry.clear()).toBe(false);
  });
});
