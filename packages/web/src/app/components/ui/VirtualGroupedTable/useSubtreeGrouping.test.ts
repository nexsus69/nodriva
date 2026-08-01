import { describe, it, expect } from 'vitest';
import { GroupableItem } from './useSubtreeGrouping.js';

interface TestItem extends GroupableItem {
  title: string;
}

function groupSubtreeItems<T extends GroupableItem>(items: T[]) {
  const groups: { nodeId: string; nodeName: string; nodePath: string; nodeDepth: number; items: T[] }[] = [];
  let currentGroup: (typeof groups)[number] | null = null;

  for (const item of items) {
    if (!currentGroup || currentGroup.nodeId !== item.nodeId) {
      currentGroup = {
        nodeId: item.nodeId,
        nodeName: item.nodeName,
        nodePath: item.nodePath,
        nodeDepth: item.nodeDepth,
        items: [],
      };
      groups.push(currentGroup);
    }
    currentGroup.items.push(item);
  }
  return groups;
}

describe('useSubtreeGrouping (Pure Grouping Unit Tests)', () => {
  it('raggruppa correttamente le entità per nodeId mantenendo l ordine originale', () => {
    const items: TestItem[] = [
      { id: '1', nodeId: 'n-1', nodeName: 'Node 1', nodePath: 'path.1', nodeDepth: 0, title: 'Item 1' },
      { id: '2', nodeId: 'n-1', nodeName: 'Node 1', nodePath: 'path.1', nodeDepth: 0, title: 'Item 2' },
      { id: '3', nodeId: 'n-2', nodeName: 'Node 2', nodePath: 'path.2', nodeDepth: 1, title: 'Item 3' },
    ];

    const result = groupSubtreeItems(items);

    expect(result.length).toBe(2);
    expect(result[0].nodeId).toBe('n-1');
    expect(result[0].items.length).toBe(2);
    expect(result[0].items.map((i) => i.id)).toEqual(['1', '2']);

    expect(result[1].nodeId).toBe('n-2');
    expect(result[1].items.length).toBe(1);
    expect(result[1].items[0].id).toBe('3');
  });

  it('restituisce un array vuoto se non ci sono elementi', () => {
    const result = groupSubtreeItems([]);
    expect(result).toEqual([]);
  });
});
