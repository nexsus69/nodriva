import type { ReactNode } from 'react';

export interface ResponsiveDataColumn<T> {
  key: string;
  header: ReactNode;
  render: (item: T) => ReactNode;
}

export interface ResponsiveDataViewProps<T> {
  items: readonly T[];
  columns: readonly ResponsiveDataColumn<T>[];
  getKey: (item: T) => string;
  renderActions?: (item: T) => ReactNode;
  empty?: ReactNode;
}

/** Generic list surface: columns on desktop, labelled cards on mobile. */
export function ResponsiveDataView<T>({ items, columns, getKey, renderActions, empty = 'Nessun elemento.' }: ResponsiveDataViewProps<T>) {
  if (items.length === 0) return <>{empty}</>;
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div role="table" className="hidden md:block">
        <div role="row" className="grid grid-cols-[repeat(auto-fit,minmax(0,1fr))_auto] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {columns.map((column) => <div role="columnheader" key={column.key}>{column.header}</div>)}
          {renderActions && <div role="columnheader" aria-label="Azioni" />}
        </div>
        {items.map((item) => (
          <div role="row" key={getKey(item)} className="grid grid-cols-[repeat(auto-fit,minmax(0,1fr))_auto] gap-4 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0">
            {columns.map((column) => <div role="cell" key={column.key} className="min-w-0 break-words text-slate-700">{column.render(item)}</div>)}
            {renderActions && <div role="cell" className="flex items-center justify-end">{renderActions(item)}</div>}
          </div>
        ))}
      </div>
      <div className="divide-y divide-slate-100 md:hidden">
        {items.map((item) => (
          <article key={getKey(item)} className="space-y-2 p-4">
            {columns.map((column) => (
              <div key={column.key} className="grid grid-cols-[minmax(6rem,35%)_minmax(0,1fr)] items-start gap-3 text-xs">
                <span className="font-semibold uppercase tracking-wide text-slate-400">{column.header}</span>
                <span className="min-w-0 break-words text-slate-700">{column.render(item)}</span>
              </div>
            ))}
            {renderActions && <div className="flex justify-end pt-1">{renderActions(item)}</div>}
          </article>
        ))}
      </div>
    </div>
  );
}
