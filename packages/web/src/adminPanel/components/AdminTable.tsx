"use client";

/** Renders any administrative collection from typed column and row-action definitions. */
import type { ReactNode } from "react";

export interface AdminTableColumn<TRow> {
  key: string;
  label: string;
  render: (row: TRow) => ReactNode;
  className?: string;
}

export interface AdminTableAction<TRow> {
  key: string;
  label: string;
  tone?: "neutral" | "primary" | "danger";
  hidden?: (row: TRow) => boolean;
  onClick: (row: TRow) => void;
}

export function AdminTable<TRow extends { id: string }>({
  rows,
  columns,
  actions,
  emptyLabel,
}: {
  rows: readonly TRow[];
  columns: readonly AdminTableColumn<TRow>[];
  actions?: readonly AdminTableAction<TRow>[];
  emptyLabel: string;
}) {
  return (
    <div className="overflow-hidden border border-slate-200">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-slate-200 bg-slate-50 uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={`px-4 py-3 ${column.className ?? ""}`}>
                {column.label}
              </th>
            ))}
            {actions && actions.length > 0 && <th className="px-4 py-3 text-right"> </th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50">
              {columns.map((column) => (
                <td key={column.key} className={`px-4 py-3 ${column.className ?? ""}`}>
                  {column.render(row)}
                </td>
              ))}
              {actions && actions.length > 0 && (
                <td className="px-4 py-3 text-right">
                  {actions
                    .filter((action) => !action.hidden?.(row))
                    .map((action) => (
                      <button
                        key={action.key}
                        type="button"
                        onClick={() => action.onClick(row)}
                        className={`mr-3 font-semibold ${action.tone === "danger" ? "text-rose-600" : action.tone === "primary" ? "text-indigo-600" : "text-slate-500"}`}
                      >
                        {action.label}
                      </button>
                    ))}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="p-6 text-center text-sm text-slate-500">{emptyLabel}</p>
      )}
    </div>
  );
}
