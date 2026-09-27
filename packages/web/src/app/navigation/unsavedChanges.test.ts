/** Verifies dirty-value utilities and shared discard cleanup for blocked navigation. */
import { describe, expect, it } from 'vitest';
import { NavigationBlockerRegistry } from './NavigationBlocker';
import { areFormValuesEqual, hasSelectedFiles } from './unsavedChanges';

describe('NavigationBlockerRegistry', () => {
  it('rimane bloccato finché esiste almeno un form modificato', () => {
    const registry = new NavigationBlockerRegistry();
    registry.setBlocked('node', true);
    registry.setBlocked('admin-modal', true);
    registry.setBlocked('node', false);
    expect(registry.isBlocked).toBe(true);
    registry.setBlocked('admin-modal', false);
    expect(registry.isBlocked).toBe(false);
  });

  it('sblocca tutte le bozze dopo la conferma di uscita globale', () => {
    const registry = new NavigationBlockerRegistry();
    const discarded: string[] = [];
    registry.setBlocked('node', true, () => discarded.push('node'));
    registry.setBlocked('admin-modal', true, () => discarded.push('admin-modal'));
    expect(registry.clear()).toBe(true);
    expect(registry.isBlocked).toBe(false);
    expect(discarded).toEqual(['node', 'admin-modal']);
    expect(registry.clear()).toBe(false);
  });

  it('non segnala cambiamenti quando registra due volte lo stesso stato', () => {
    const registry = new NavigationBlockerRegistry();
    expect(registry.setBlocked('entity', true)).toBe(true);
    expect(registry.setBlocked('entity', true)).toBe(false);
  });
});

describe('unsaved form values', () => {
  it('confronta payload annidati senza dipendere dall’ordine delle chiavi', () => {
    expect(areFormValuesEqual({ name: 'A', payload: { count: 2, active: true } }, { payload: { active: true, count: 2 }, name: 'A' })).toBe(true);
  });

  it('rileva valori e allegati modificati', () => {
    expect(areFormValuesEqual({ tags: ['a', 'b'] }, { tags: ['b', 'a'] })).toBe(false);
    expect(hasSelectedFiles({ documents: [{} as File] })).toBe(true);
    expect(hasSelectedFiles({ documents: [] })).toBe(false);
  });
});
