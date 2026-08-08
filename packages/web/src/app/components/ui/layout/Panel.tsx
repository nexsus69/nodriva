import type { ReactNode } from 'react';

export interface PanelProps {
  children: ReactNode;
  as?: 'div' | 'section' | 'aside';
  className?: string;
}

/** Shared surface primitive; callers provide semantic content and behavior. */
export function Panel({ children, as = 'section', className = '' }: PanelProps) {
  const Component = as;
  return (
    <Component className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      {children}
    </Component>
  );
}
