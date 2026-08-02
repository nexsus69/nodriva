'use client';

import React, { ReactNode } from 'react';
import { VirtualTableColumnDef, RowActionSlotProps } from './types';
import { useCacheEntity } from '../../../hooks/useCacheEntity';
import { LockIndicator } from '../../LockIndicator';

interface VirtualTableRowProps<T> {
  item: T;
  columns: VirtualTableColumnDef<T>[];
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  renderActions?: (props: RowActionSlotProps<T>) => ReactNode;
  gridTemplateColumns: string;
}

export function VirtualTableRow<T extends { id: string, entityTypeId?: string }>({
  item,
  columns,
  isSelected,
  onToggleSelect,
  renderActions,
  gridTemplateColumns,
}: VirtualTableRowProps<T>) {
  // Se l'elemento ha un entityTypeId, lo iscriviamo alla Cache.
  // In questo modo, qualsiasi modifica in altre parti della UI aggiornerà in tempo reale questa riga.
  const { data: cachedEntity } = useCacheEntity(item.entityTypeId || 'unknown', item.id);
  
  // Uniamo i dati strutturali della riga (es. nodeDepth) con i dati "veri" dell'entità presi dalla Cache.
  const renderItem = (item.entityTypeId && cachedEntity) 
    ? { ...item, ...cachedEntity } as unknown as T 
    : item;

  return (
    <div
      role="row"
      data-row-id={item.id}
      aria-selected={isSelected}
      className={`grid min-h-[58px] items-center gap-4 border-b border-slate-100 px-5 py-3 text-sm transition-colors ${
        isSelected
          ? 'bg-indigo-50 text-slate-800 hover:bg-indigo-100/70'
          : 'text-slate-600 hover:bg-slate-50'
      }`}
      style={{ gridTemplateColumns }}
    >
      {onToggleSelect && (
        <div role="cell" className="w-5 flex items-center justify-center">
          <input
            type="checkbox"
            checked={!!isSelected}
            onChange={() => onToggleSelect(renderItem.id)}
            className="cursor-pointer rounded border-slate-300 bg-white text-indigo-600 focus:ring-indigo-500"
          />
        </div>
      )}
      <div role="cell" className="flex items-center justify-center">
        <LockIndicator resourceType="entity" resourceId={renderItem.id} />
      </div>
      {columns.map((col) => {
        const val = (renderItem as Record<string, unknown>)[col.key];
        const content = col.render ? col.render(renderItem) : (val !== undefined && val !== null ? String(val) : '-');
        return (
          <div role="cell" key={col.key} className="truncate">
            {content}
          </div>
        );
      })}
      {renderActions && (
        <div role="cell" className="flex items-center justify-end gap-2">
          {renderActions({ item: renderItem })}
        </div>
      )}
    </div>
  );
}
