/** Provides one compact toolbar contract for Admin collections. */
import type { ReactNode } from "react";
import { AdminButton } from "./AdminButton";
import { AdminIcon } from "./AdminIcon";

/** Groups search, filter content, result metadata, and refresh behavior. */
export function AdminToolbar({
  search,
  meta,
  children,
  refreshLabel,
  onRefresh,
}: {
  search?: {
    value: string;
    label: string;
    placeholder: string;
    onChange: (value: string) => void;
  };
  meta?: ReactNode;
  children?: ReactNode;
  refreshLabel?: string;
  onRefresh?: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center">
      {search && (
        <label className="relative min-w-0 flex-1 sm:max-w-md">
          <span className="sr-only">{search.label}</span>
          <AdminIcon name="search" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search.value}
            onChange={(event) => search.onChange(event.target.value)}
            placeholder={search.placeholder}
            className="h-9 w-full border border-slate-300 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-500/15"
          />
        </label>
      )}
      {children && <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>}
      {meta && <div className="text-xs tabular-nums text-slate-500">{meta}</div>}
      {onRefresh && refreshLabel && (
        <AdminButton tone="quiet" compact icon="refresh" onClick={onRefresh} aria-label={refreshLabel}>
          <span className="hidden sm:inline">{refreshLabel}</span>
        </AdminButton>
      )}
    </div>
  );
}
