'use client';

import { PageShell, Panel } from '../../../components/ui/layout';
import { useAppLocale } from '@/app/i18n/AppLocaleStore';

export function NodeAccessUnavailable({ onRetry }: { onRetry: () => void }) {
  const { t } = useAppLocale();
  return (
    <PageShell>
      <Panel className="mx-auto max-w-xl space-y-4 border-amber-200 bg-amber-50">
        <div className="text-4xl">⚠️</div>
        <h1 className="text-xl font-semibold text-slate-900">{t('node.accessUnavailable')}</h1>
        <p className="text-sm text-slate-600">{t('node.accessUnavailableDescription')}</p>
        <button type="button" onClick={onRetry} className="inline-flex rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-500">{t('common.retry')}</button>
      </Panel>
    </PageShell>
  );
}
