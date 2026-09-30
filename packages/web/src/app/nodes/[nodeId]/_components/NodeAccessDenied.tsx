/** Presents a denied node without exposing hierarchy details. */
import Link from '@/app/components/navigation/GuardedLink';
import { PageShell, Panel } from '../../../components/ui/layout';
import { useAppLocale } from '../../../i18n/AppLocaleStore';

export function NodeAccessDenied() {
  const { t } = useAppLocale();
  return <PageShell><Panel className="mx-auto max-w-xl space-y-4 border-rose-200 bg-rose-50">
    <div className="text-4xl">🔒</div>
    <h1 className="text-xl font-semibold text-slate-900">{t('node.accessDenied')}</h1>
    <p className="text-sm text-slate-600">{t('node.accessDeniedDescription')}</p>
    <Link href="/" className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500">{t('node.returnToWorkspace')}</Link>
  </Panel></PageShell>;
}
