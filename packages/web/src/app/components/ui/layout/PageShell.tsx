import type { ReactNode } from 'react';

export interface PageShellProps {
  children: ReactNode;
  className?: string;
}

/** Shared responsive page frame. It owns spacing, not page/domain behavior. */
export function PageShell({ children, className = '' }: PageShellProps) {
  return (
    <div className={`workspace-page mx-auto w-full max-w-7xl space-y-6 pb-8 ${className}`}>
      {children}
    </div>
  );
}
