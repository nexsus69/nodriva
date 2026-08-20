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

function VirtualTableRowComponent<T extends { id: string, entityTypeId?: string }>({
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
      className={`border-b border-slate-100 px-3 py-3 text-sm transition-colors sm:px-5 ${
        isSelected
          ? 'bg-indigo-50 text-slate-800 hover:bg-indigo-100/70'
          : 'text-slate-600 hover:bg-slate-50'
      }`}
    >
      <div className="hidden min-h-[58px] items-start gap-4 leading-5 md:grid" style={{ gridTemplateColumns }}>
        {onToggleSelect && (
          <div role="cell" className="flex w-5 items-center justify-center">
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
          return <div role="cell" key={col.key} className="min-w-0 whitespace-normal break-words">{content}</div>;
        })}
        {renderActions && <div role="cell" className="flex items-center justify-end gap-2">{renderActions({ item: renderItem })}</div>}
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 pb-2">
          <div className="flex min-w-0 items-start gap-2">
            {onToggleSelect && (
              <input
                type="checkbox"
                checked={!!isSelected}
                onChange={() => onToggleSelect(renderItem.id)}
                className="mt-1 cursor-pointer rounded border-slate-300 bg-white text-indigo-600 focus:ring-indigo-500"
              />
            )}
            <div className="min-w-0">
              <div className="break-words font-semibold leading-5 text-slate-800">
                {columns[0]?.render
                  ? columns[0].render(renderItem)
                  : String((renderItem as Record<string, unknown>)[columns[0]?.key ?? 'name'] ?? '-')}
              </div>
              <p className="mt-0.5 break-all text-[10px] font-mono text-slate-400">{renderItem.id}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <LockIndicator resourceType="entity" resourceId={renderItem.id} />
            {renderActions && renderActions({ item: renderItem })}
          </div>
        </div>

        <div className="grid gap-2">
          {columns.slice(1).map((col) => {
            const val = (renderItem as Record<string, unknown>)[col.key];
            const content = col.render ? col.render(renderItem) : (val !== undefined && val !== null ? String(val) : '-');
            return (
              <div role="cell" key={col.key} className="grid grid-cols-[minmax(90px,35%)_minmax(0,1fr)] items-start gap-3 text-xs">
                <span className="font-semibold uppercase tracking-wide text-slate-400">{col.header}</span>
                <span className="min-w-0 break-words text-slate-700">{content}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function equalRowItems<T extends { id: string }>(left: T, right: T): boolean {
  if (left === right) return true;
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const keys = new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)]);
  for (const key of keys) {
    if (leftRecord[key] !== rightRecord[key]) return false;
  }
  return true;
}

function areRowsEqual<T extends { id: string }>(
  previous: VirtualTableRowProps<T>,
  next: VirtualTableRowProps<T>,
): boolean {
  if (!equalRowItems(previous.item, next.item)) return false;
  if (previous.isSelected !== next.isSelected) return false;
  if (previous.gridTemplateColumns !== next.gridTemplateColumns) return false;
  if (previous.columns.length !== next.columns.length) return false;
  return previous.columns.every((column, index) => {
    const nextColumn = next.columns[index];
    return column.key === nextColumn.key
      && column.header === nextColumn.header
      && column.width === nextColumn.width;
  });
}

export const VirtualTableRow = React.memo(VirtualTableRowComponent, areRowsEqual) as typeof VirtualTableRowComponent;
