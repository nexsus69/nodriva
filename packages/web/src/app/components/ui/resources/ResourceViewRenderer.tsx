'use client';

import type { ResourceActionDefinition, ResourceViewDefinition } from '@dashboard/core';

export interface ResourceViewRendererProps {
  view: ResourceViewDefinition;
  rows: readonly Record<string, unknown>[];
  actions?: readonly ResourceActionDefinition[];
  getRowKey?: (row: Record<string, unknown>, index: number) => string;
  onAction?: (action: ResourceActionDefinition, row: Record<string, unknown>) => void;
  emptyMessage?: string;
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sì' : 'No';
  if (value instanceof Date) return value.toLocaleString('it-IT');
  return String(value);
}

export function ResourceViewRenderer({ view, rows, actions = [], getRowKey = (_, index) => String(index), onAction, emptyMessage = 'Nessun elemento presente.' }: ResourceViewRendererProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-left text-xs text-slate-700">
        <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            {view.columns.map((column) => <th key={column.key} scope="col" className="px-4 py-3 font-semibold">{column.label}</th>)}
            {actions.length > 0 && <th scope="col" className="px-4 py-3 text-right font-semibold">Azioni</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr><td colSpan={view.columns.length + (actions.length > 0 ? 1 : 0)} className="px-4 py-8 text-center text-slate-500">{emptyMessage}</td></tr>
          ) : rows.map((row, index) => (
            <tr key={getRowKey(row, index)} className="hover:bg-slate-50">
              {view.columns.map((column) => <td key={column.key} className="px-4 py-3">{renderValue(row[column.key])}</td>)}
              {actions.length > 0 && (
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    {actions.map((action) => (
                      <button key={action.key} type="button" onClick={() => onAction?.(action, row)} className={action.destructive ? 'text-red-600 hover:text-red-800' : 'text-indigo-600 hover:text-indigo-800'}>
                        {action.label}
                      </button>
                    ))}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
