import type { ReactNode } from 'react';

export interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  breadcrumb?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** Responsive page heading with independent breadcrumb and action slots. */
export function PageHeader({
  eyebrow,
  title,
  description,
  breadcrumb,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <header className={`space-y-3 border-b border-slate-200 pb-4 ${className}`}>
      {breadcrumb}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-500">{eyebrow}</div>}
          <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {description && <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-slate-500">{description}</p>}
        </div>
        {actions && <div className="flex max-w-full flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">{actions}</div>}
      </div>
    </header>
  );
}
