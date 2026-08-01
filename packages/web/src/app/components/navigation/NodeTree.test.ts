import { describe, expect, it } from 'vitest';
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
