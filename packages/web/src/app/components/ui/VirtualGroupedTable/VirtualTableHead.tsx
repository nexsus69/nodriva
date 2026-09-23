'use client';

import React from 'react';
import { VirtualTableColumnDef } from './types';
import { useAppLocale } from '@/app/i18n/AppLocaleStore';

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
  const { t } = useAppLocale();
  return (
    <div
      role="rowgroup"
      style={{ overflowAnchor: 'none' }}
      className="sticky top-0 z-20 hidden border-b border-slate-200 bg-slate-50/95 text-xs font-semibold uppercase tracking-wide text-slate-400 backdrop-blur md:block"
    >
      <div
        role="row"
          className="grid items-start gap-4 px-5 py-3.5"
        style={{ gridTemplateColumns }}
      >
        {hasSelection && (
          <div role="columnheader" className="w-5 flex items-center justify-center">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={onToggleSelectAll}
              className="cursor-pointer rounded border-slate-300 bg-white text-indigo-600 focus:ring-indigo-500"
            />
          </div>
        )}
        <div role="columnheader" aria-label={t('table.lockStatus')} className="flex items-center justify-center">
          <span aria-hidden="true">🔒</span>
        </div>
        {columns.map((col) => (
          <div role="columnheader" key={col.key} className="min-w-0 whitespace-normal break-words leading-4">
            {col.header}
          </div>
        ))}
        {hasRowActions && (
          <div role="columnheader" className="min-w-0 text-right whitespace-normal break-words leading-4">
            {t('common.actions')}
          </div>
        )}
      </div>
    </div>
  );
}
