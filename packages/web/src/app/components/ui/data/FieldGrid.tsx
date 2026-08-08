import type { ReactNode } from 'react';

export interface FieldGridItem {
  key: string;
  label: ReactNode;
  value: ReactNode;
}

export function FieldGrid({ items, className = '' }: { items: readonly FieldGridItem[]; className?: string }) {
  return (
    <dl className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${className}`}>
      {items.map((item) => (
        <div key={item.key} className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
          <dt className="break-words text-[10px] uppercase tracking-wider text-slate-400">{item.label}</dt>
          <dd className="mt-1 min-w-0 break-words text-sm text-slate-700">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
