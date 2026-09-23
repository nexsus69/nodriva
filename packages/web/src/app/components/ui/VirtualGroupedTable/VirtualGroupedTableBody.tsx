'use client';

import React from 'react';
import type { GroupedNode, GroupableItem } from './useSubtreeGrouping';
import type { GroupHeaderSlotProps, RowActionSlotProps, VirtualTableColumnDef } from './types';
import { VirtualGroupHeader } from './VirtualGroupHeader';
import { VirtualTableRow } from './VirtualTableRow';
import { Skeleton, SkeletonState } from '../feedback';
import { useAppLocale } from '@/app/i18n/AppLocaleStore';

interface VirtualGroupedTableBodyProps<T extends GroupableItem> {
  items: T[];
  groupedItems: GroupedNode<T>[];
  columns: VirtualTableColumnDef<T>[];
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  onRetry?: () => void;
  emptyStateMessage: string;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  renderGroupHeaderActions?: (props: GroupHeaderSlotProps) => React.ReactNode;
  renderRowActions?: (props: RowActionSlotProps<T>) => React.ReactNode;
  gridTemplateColumns: string;
}

export function VirtualGroupedTableBody<T extends GroupableItem>({
  items,
  groupedItems,
  columns,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  emptyStateMessage,
  selectedIds,
  onToggleSelect,
  renderGroupHeaderActions,
  renderRowActions,
  gridTemplateColumns,
}: VirtualGroupedTableBodyProps<T>) {
  const { t } = useAppLocale();
  return (
    <>
      {isError && (
        <div
          className="flex shrink-0 items-center justify-between border-b border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700"
          style={{ overflowAnchor: 'none' }}
        >
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="rounded-lg bg-rose-600 px-2.5 py-1 font-medium text-white shadow-sm transition-colors hover:bg-rose-500"
            >
              {t('common.retry')}
            </button>
          )}
        </div>
      )}

      {isLoading && items.length === 0 ? (
        <SkeletonState label={t('table.loadingData')} className="divide-y divide-slate-100">{Array.from({ length: 6 }, (_, row) => <div key={row} className="grid items-center gap-3 px-4 py-4" style={{ gridTemplateColumns }}>{columns.map((column, columnIndex) => <Skeleton key={column.key} className={`h-3 ${columnIndex === 0 ? 'w-4' : row % 2 === 0 ? 'w-4/5' : 'w-3/5'}`} />)}</div>)}</SkeletonState>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-xl">⌁</span>
          <span className="text-sm font-medium text-slate-600">{emptyStateMessage}</span>
        </div>
      ) : (
        <div role="rowgroup" className="flex flex-col w-full">
          {groupedItems.map((group, index) => (
            <React.Fragment key={`${group.nodeId}-${index}`}>
              <VirtualGroupHeader
                nodeId={group.nodeId}
                nodeName={group.nodeName}
                nodePath={group.nodePath}
                nodeDepth={group.nodeDepth}
                renderActions={renderGroupHeaderActions}
              />
              {group.items.map((item) => (
                <VirtualTableRow
                  key={item.id}
                  item={item}
                  columns={columns}
                  isSelected={selectedIds?.has(item.id)}
                  onToggleSelect={onToggleSelect}
                  renderActions={renderRowActions}
                  gridTemplateColumns={gridTemplateColumns}
                />
              ))}
            </React.Fragment>
          ))}
        </div>
      )}
    </>
  );
}
