/** Renders the persistent application footer with copyright notice and AI co-creation attribution. */

'use client';

import { useAppLocale } from '@/app/i18n/AppLocaleStore';

interface AppFooterProps {
  className?: string;
}

export function AppFooter({ className = '' }: AppFooterProps) {
  const { t } = useAppLocale();
  const year = new Date().getFullYear();
  const copyright = t('footer.copyright').replace('{year}', String(year));

  return (
    <footer
      role="contentinfo"
      className={`border-t border-slate-200/80 px-5 py-4 text-xs text-slate-500 sm:px-8 lg:px-10 ${className}`}
    >
      <div className="mx-auto flex flex-col items-center justify-between gap-2 text-center sm:flex-row sm:text-left">
        <span>{copyright}</span>
        <span className="text-slate-400">{t('footer.aiAssisted')}</span>
      </div>
    </footer>
  );
}
