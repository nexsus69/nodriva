import { useMemo } from 'react';
import { groupSubtreeItems, type GroupableItem, type GroupedNode } from './virtualTableModel';

export type { GroupableItem, GroupedNode } from './virtualTableModel';

/**
 * Hook puro per il raggruppamento deterministico delle entità piatte per nodeId.
 * Nessun accesso al DOM, nessun side effect.
 */
export function useSubtreeGrouping<T extends GroupableItem>(items: T[]): GroupedNode<T>[] {
  return useMemo(() => groupSubtreeItems(items), [items]);
}
