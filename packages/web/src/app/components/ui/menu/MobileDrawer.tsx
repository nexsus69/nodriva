'use client';

import { useEffect, type ReactNode } from 'react';
import { useAppLocale } from '@/app/i18n/AppLocaleStore';

export interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  side?: 'left' | 'right';
}

/** Responsive drawer surface for navigation or contextual mobile panels. */
export function MobileDrawer({ open, onClose, title, children, side = 'left' }: MobileDrawerProps) {
  const { t } = useAppLocale();
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : t('common.mobilePanel')}>
      <button type="button" aria-label={t('common.closePanel')} onClick={onClose} className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px]" />
      <aside className={`absolute inset-y-0 flex w-[min(22rem,calc(100vw-2rem))] flex-col bg-white p-4 shadow-2xl ${side === 'left' ? 'left-0' : 'right-0'}`}>
        <div className="flex min-h-10 items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="min-w-0 break-words text-sm font-semibold text-slate-800">{title}</div>
          <button type="button" onClick={onClose} aria-label={t('common.closePanel')} className="shrink-0 px-2 py-1 text-lg text-slate-500 hover:bg-slate-100">×</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-4">{children}</div>
      </aside>
    </div>
  );
}
