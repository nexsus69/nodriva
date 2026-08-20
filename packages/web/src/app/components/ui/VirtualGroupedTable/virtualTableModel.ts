import type { VirtualTableColumnDef } from './types';

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

export function groupSubtreeItems<T extends GroupableItem>(items: T[]): GroupedNode<T>[] {
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
}

export function buildGridTemplateColumns<T>(
  columns: VirtualTableColumnDef<T>[],
  hasSelection: boolean,
  hasRowActions: boolean,
): string {
  return [
    ...(hasSelection ? ['32px'] : []),
    '32px',
    ...columns.map((column) => column.width || '1fr'),
    ...(hasRowActions ? ['120px'] : []),
  ].join(' ');
}

export function areAllItemsSelected<T extends { id: string }>(items: T[], selectedIds?: Set<string>): boolean {
  return !!selectedIds && items.length > 0 && items.every((item) => selectedIds.has(item.id));
}

export function toggleItemSelection(selectedIds: Set<string>, id: string): Set<string> {
  const next = new Set(selectedIds);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function toggleAllItems<T extends { id: string }>(
  items: T[],
  selectedIds: Set<string>,
): Set<string> {
  return areAllItemsSelected(items, selectedIds)
    ? new Set()
    : new Set(items.map((item) => item.id));
}
