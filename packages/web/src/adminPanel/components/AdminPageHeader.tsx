/** Renders consistent Admin hierarchy, breadcrumbs, and primary actions. */
import type { ReactNode } from "react";
import { AdminIcon } from "./AdminIcon";

export interface AdminBreadcrumbItem {
  label: string;
  onClick?: () => void;
}

/** Owns the heading geometry shared by collection, detail, and overview screens. */
export function AdminPageHeader({
  title,
  description,
  icon,
  breadcrumbs = [],
  actions,
}: {
  title: string;
  description?: string;
  icon?: string;
  breadcrumbs?: readonly AdminBreadcrumbItem[];
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            {breadcrumbs.map((item, index) => (
              <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5">
                {index > 0 && <AdminIcon name="chevron-right" className="size-3 text-slate-300" />}
                {item.onClick ? (
                  <button type="button" onClick={item.onClick} className="hover:text-violet-700">
                    {item.label}
                  </button>
                ) : (
                  <span aria-current={index === breadcrumbs.length - 1 ? "page" : undefined}>{item.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <div className="flex min-w-0 items-start gap-3">
          {icon && (
            <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center border border-violet-100 bg-violet-50 text-violet-700">
              <AdminIcon name={icon} className="size-5" />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-slate-950 sm:text-[1.75rem]">
              {title}
            </h1>
            {description && (
              <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">
                {description}
              </p>
            )}
          </div>
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
