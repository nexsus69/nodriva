import { describe, expect, it } from 'vitest';
import {
  areAllItemsSelected,
  buildGridTemplateColumns,
  toggleAllItems,
  toggleItemSelection,
} from './virtualTableModel';

const items = [{ id: 'one' }, { id: 'two' }];

describe('virtual table view model', () => {
  it('preserves the desktop grid contract for selection, lock, data and actions', () => {
    expect(buildGridTemplateColumns([
      { key: 'name', header: 'Nome', width: '2fr' },
      { key: 'status', header: 'Stato' },
    ], true, true)).toBe('32px 32px 2fr 1fr 120px');

    expect(buildGridTemplateColumns([{ key: 'name', header: 'Nome' }], false, false))
      .toBe('32px 1fr');
  });

  it('selects the current window only and clears it when already complete', () => {
    expect(toggleAllItems(items, new Set(['outside']))).toEqual(new Set(['one', 'two']));
    expect(toggleAllItems(items, new Set(['one', 'two', 'outside']))).toEqual(new Set());
    expect(areAllItemsSelected([], new Set())).toBe(false);
  });

  it('toggles one id without mutating the caller set', () => {
    const selected = new Set(['one']);
    const removed = toggleItemSelection(selected, 'one');
    const added = toggleItemSelection(selected, 'two');

    expect(selected).toEqual(new Set(['one']));
    expect(removed).toEqual(new Set());
    expect(added).toEqual(new Set(['one', 'two']));
  });
});
