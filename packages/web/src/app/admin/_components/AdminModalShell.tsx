import type { ReactNode } from 'react';

export interface AdminModalShellProps {
  children: ReactNode;
  className?: string;
}

/** Shared dark modal surface used by administrative forms. */
export function AdminModalShell({ children, className = 'max-w-md' }: AdminModalShellProps) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className={`glass-panel border border-slate-800 rounded-2xl w-full p-6 space-y-6 shadow-2xl ${className}`}>
        {children}
      </div>
    </div>
  );
}
