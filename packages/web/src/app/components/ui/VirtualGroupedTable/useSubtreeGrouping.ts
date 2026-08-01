import { useMemo } from 'react';

export interface GroupableItem {
  id: string;
  nodeId: string;
  nodeName: string;
  nodePath: string;
  nodeDepth: number;
}

export interface GroupedNode<T extends GroupableItem> {
  nodeId: string;
  nodeName: string;
  nodePath: string;
  nodeDepth: number;
  items: T[];
}

/**
 * Hook puro per il raggruppamento deterministico delle entità piatte per nodeId.
 * Nessun accesso al DOM, nessun side effect.
 */
export function useSubtreeGrouping<T extends GroupableItem>(items: T[]): GroupedNode<T>[] {
  return useMemo(() => {
    const groups: GroupedNode<T>[] = [];
    let currentGroup: GroupedNode<T> | null = null;

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
  }, [items]);
}
