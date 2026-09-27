'use client';

/** Hosts the single accessible success outcome surface for every user mutation. */
import { Alert } from '@/app/components/ui/feedback';
import { useAppLocale } from '@/app/i18n/AppLocaleStore';
import { useMutationOutcomeStore } from './MutationOutcomeStore';

/** Keeps a completed operation visible after a modal closes or a route changes. */
export function MutationOutcomeHost() {
  const { t } = useAppLocale();
  const success = useMutationOutcomeStore((state) => state.success);
  const dismissSuccess = useMutationOutcomeStore((state) => state.dismissSuccess);

  if (!success) return null;
  return (
    <div className="fixed right-4 top-4 z-[60] w-[min(24rem,calc(100vw-2rem))]" role="status" aria-live="polite">
      <Alert tone="success" className="flex items-start justify-between gap-3 shadow-lg">
        <span>{t(success.messageKey)}</span>
        <button type="button" aria-label={t('common.closeWindow')} onClick={dismissSuccess} className="shrink-0 font-semibold underline">
          ×
        </button>
      </Alert>
    </div>
  );
}
