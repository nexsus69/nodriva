/** Renders consistent title, close action, and optional tabs for every Admin surface. */
import type { ReactNode } from "react";
import { AdminIcon } from "./AdminIcon";

export interface AdminSurfaceTab {
  key: string;
  label: string;
}

export function AdminSurfaceHeader({
  title,
  titleId,
  eyebrow,
  subtitle,
  closeLabel,
  onClose,
  closeIcon = "close",
  tabs = [],
  activeTab,
  onTabChange,
  actions,
  appearance = "light",
}: {
  title: string;
  titleId: string;
  eyebrow?: string;
  subtitle?: string;
  closeLabel: string;
  onClose: () => void;
  closeIcon?: string;
  tabs?: readonly AdminSurfaceTab[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  actions?: ReactNode;
  appearance?: "light" | "dark";
}) {
  const dark = appearance === "dark";
  return (
    <header className={`sticky top-0 z-20 border-b px-6 py-4 ${dark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-white"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${dark ? "text-violet-300" : "text-violet-700"}`}>
              {eyebrow}
            </p>
          )}
          <h2 id={titleId} className={`truncate text-lg font-semibold ${dark ? "text-white" : "text-slate-950"}`}>
            {title}
          </h2>
          {subtitle && (
            <p className={`mt-1 truncate text-xs ${dark ? "text-slate-400" : "text-slate-500"}`}>
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className={`flex size-8 items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${dark ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"}`}
          >
            <AdminIcon name={closeIcon} className="size-4" />
          </button>
        </div>
      </div>
      {tabs.length > 0 && (
        <nav className="-mb-4 mt-4 flex gap-5" aria-label={title}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              aria-current={activeTab === tab.key ? "page" : undefined}
              onClick={() => onTabChange?.(tab.key)}
              className={`border-b-2 pb-3 text-sm font-semibold transition ${activeTab === tab.key ? "border-violet-600 text-violet-700" : dark ? "border-transparent text-slate-400 hover:text-slate-200" : "border-transparent text-slate-500 hover:text-slate-800"}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      )}
    </header>
  );
}
