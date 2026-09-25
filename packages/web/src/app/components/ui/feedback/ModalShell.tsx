'use client';

import type { ReactNode } from 'react';
import { useAppLocale } from '@/app/i18n/AppLocaleStore';

/** Renders an accessible modal with the appearance supplied by its owning form surface. */
export function ModalShell({ open, title, children, onClose, className = '', appearance = 'light' }: { open: boolean; title: ReactNode; children: ReactNode; onClose: () => void; className?: string; appearance?: 'light' | 'dark' }) {
  const { t } = useAppLocale();
  if (!open) return null;
  const dark = appearance === 'dark';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : t('common.dialog')}>
      <button type="button" aria-label={t('common.closeWindow')} onClick={onClose} className="fixed inset-0 bg-slate-950/50" />
      <div className={`relative z-10 max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border p-5 shadow-2xl sm:p-6 ${dark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'} ${className}`}>
        <div className={`mb-4 flex items-start justify-between gap-3 border-b pb-3 ${dark ? 'border-slate-700' : 'border-slate-200'}`}><h2 className={`min-w-0 break-words text-sm font-semibold ${dark ? 'text-slate-100' : 'text-slate-800'}`}>{title}</h2><button type="button" onClick={onClose} aria-label={t('common.closeWindow')} className={`shrink-0 rounded-lg px-2 py-1 text-lg leading-none ${dark ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100'}`}>×</button></div>
        {children}
      </div>
    </div>
  );
}
