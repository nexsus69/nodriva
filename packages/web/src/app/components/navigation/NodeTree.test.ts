import { describe, expect, it } from 'vitest';
import { resolveNodeTreeItemState, toggleNodeExpansion } from './nodeTreeModel';
import { isNodeAncestorOfPath } from './nodeTreePath';

describe('NodeTree active path expansion', () => {
  it('recognizes every real ancestor of the active node', () => {
    expect(isNodeAncestorOfPath('orders', 'orders.eu.italy')).toBe(true);
    expect(isNodeAncestorOfPath('orders.eu', 'orders.eu.italy')).toBe(true);
  });

  it('does not treat the active node itself as an ancestor', () => {
    expect(isNodeAncestorOfPath('orders.eu.italy', 'orders.eu.italy')).toBe(false);
  });

  it('does not confuse sibling paths with a common text prefix', () => {
    expect(isNodeAncestorOfPath('orders', 'orders-old.archive')).toBe(false);
    expect(isNodeAncestorOfPath('orders.eu', 'orders.europe')).toBe(false);
  });

  it('does not expand a path when there is no active node', () => {
    expect(isNodeAncestorOfPath('orders')).toBe(false);
  });
});

describe('NodeTree expansion and selection model', () => {
  it('toggles an explicit expansion without mutating the previous set', () => {
    const current = new Set(['first']);
    const expanded = toggleNodeExpansion(current, 'second');
    const collapsed = toggleNodeExpansion(expanded, 'first');

    expect([...current]).toEqual(['first']);
    expect([...expanded]).toEqual(['first', 'second']);
    expect([...collapsed]).toEqual(['second']);
  });

  it('keeps active ancestors expanded and marks only the selected node active', () => {
    expect(resolveNodeTreeItemState(
      { id: 'root', path: 'root' },
      new Set(),
      'child',
      'root.child',
    )).toEqual({ isActive: false, isActiveAncestor: true, isExpanded: true });

    expect(resolveNodeTreeItemState(
      { id: 'child', path: 'root.child' },
      new Set(),
      'child',
      'root.child',
    )).toEqual({ isActive: true, isActiveAncestor: false, isExpanded: false });
  });
});
