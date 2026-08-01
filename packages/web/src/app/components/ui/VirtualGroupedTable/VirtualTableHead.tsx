'use client';

import React from 'react';
import { VirtualTableColumnDef } from './types';

interface VirtualTableHeadProps<T> {
  columns: VirtualTableColumnDef<T>[];
  hasRowActions?: boolean;
  hasSelection?: boolean;
  isAllSelected?: boolean;
  onToggleSelectAll?: () => void;
  gridTemplateColumns: string;
}

export function VirtualTableHead<T>({
  columns,
  hasRowActions,
  hasSelection,
  isAllSelected,
  onToggleSelectAll,
  gridTemplateColumns,
}: VirtualTableHeadProps<T>) {
  return (
    <div
      role="rowgroup"
      style={{ overflowAnchor: 'none' }}
      className="sticky top-0 z-20 bg-slate-900/90 backdrop-blur border-b border-slate-800 text-xs uppercase font-semibold text-slate-400"
    >
      <div
        role="row"
        className="grid items-center px-4 py-3 gap-4"
        style={{ gridTemplateColumns }}
      >
        {hasSelection && (
          <div role="columnheader" className="w-5 flex items-center justify-center">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={onToggleSelectAll}
              className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
          </div>
        )}
        {columns.map((col) => (
          <div role="columnheader" key={col.key} className="truncate">
            {col.header}
          </div>
        ))}
        {hasRowActions && (
          <div role="columnheader" className="text-right truncate">
            Azioni
          </div>
        )}
      </div>
    </div>
  );
}
