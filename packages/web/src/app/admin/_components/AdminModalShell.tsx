import type { ReactNode } from 'react';

export interface AdminModalShellProps {
  children: ReactNode;
  className?: string;
}

/** Shared dark modal surface used by administrative forms. */
export function AdminModalShell({ children, className = 'max-w-md' }: AdminModalShellProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/80 p-3 backdrop-blur-sm sm:items-center sm:p-4">
      <div className={`glass-panel max-h-[calc(100dvh-1.5rem)] w-full max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-2xl border border-slate-800 p-4 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:p-6 ${className}`}>
        {children}
      </div>
    </div>
  );
}
