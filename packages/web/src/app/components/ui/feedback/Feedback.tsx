import type { ReactNode } from 'react';

export function StatusBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }) {
  const tones = {
    neutral: 'border-slate-200 bg-slate-100 text-slate-600',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    danger: 'border-rose-200 bg-rose-50 text-rose-700',
    info: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  } as const;
  return <span className={`inline-flex max-w-full items-center rounded-full border px-2 py-1 text-[10px] font-semibold ${tones[tone]}`}>{children}</span>;
}

export function Alert({ children, tone = 'info', role = 'status', className = '' }: { children: ReactNode; tone?: 'info' | 'success' | 'warning' | 'danger'; role?: 'alert' | 'status'; className?: string }) {
  const tones = {
    info: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    danger: 'border-rose-200 bg-rose-50 text-rose-700',
  } as const;
  return <div role={role} className={`break-words rounded-xl border p-4 text-xs ${tones[tone]} ${className}`}>{children}</div>;
}

export function EmptyState({ title = 'Nessun elemento', description, action }: { title?: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><p className="text-sm font-semibold text-slate-700">{title}</p>{description && <p className="mx-auto mt-2 max-w-md text-xs text-slate-500">{description}</p>}{action && <div className="mt-4">{action}</div>}</div>;
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`block rounded-md bg-slate-200 motion-safe:animate-pulse ${className}`} />;
}

export function SkeletonState({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return <div role="status" aria-label={label} className={className}>{children}</div>;
}
