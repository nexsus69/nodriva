import Link from '@/app/components/navigation/GuardedLink';
import { Skeleton } from '@/app/components/ui/feedback';
import { useAppLocale } from '@/app/i18n/AppLocaleStore';

export function WorkspaceHeader() {
  const { t } = useAppLocale();
  return <section className="relative overflow-hidden rounded-[2rem] border border-indigo-100 bg-gradient-to-br from-white via-indigo-50/60 to-violet-50 p-7 shadow-xl shadow-slate-200/70 sm:p-9"><div className="relative flex flex-col justify-between gap-8 lg:flex-row lg:items-end"><div className="max-w-2xl space-y-4"><div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-300/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-700">● {t('workspace.operational')}</div><div><h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{t('workspace.heroTitle')}</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">{t('workspace.heroDescription')}</p></div></div><Link href="/admin" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm">⚙ {t('workspace.controlCenter')}</Link></div></section>;
}

export function WorkspaceStats({ checking, loading, seeded, nodeCount }: { checking: boolean; loading: boolean; seeded: boolean; nodeCount: number }) {
  const { t } = useAppLocale();
  const cards = [
    { label: t('workspace.rootNodes'), value: checking || loading ? null : String(nodeCount), loadingLabel: t('workspace.loadingRootCount'), icon: '⌘' },
    { label: t('workspace.systemStatus'), value: checking ? null : seeded ? t('workspace.systemOperational') : t('workspace.configurationRequired'), loadingLabel: t('workspace.checkingSystemStatus'), icon: '●' },
    { label: t('workspace.access'), value: t('workspace.protectedSession'), loadingLabel: '', icon: '✓' },
  ];
  return <section aria-label={t('workspace.summary')} className="grid grid-cols-1 gap-3 sm:grid-cols-3">{cards.map(({ label, value, loadingLabel, icon }) => <div key={label} className="glass-panel flex items-center justify-between rounded-2xl border border-slate-200 p-5 shadow-sm"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>{value === null ? <span role="status" aria-label={loadingLabel} className="mt-2 block"><Skeleton className="h-4 w-28" /></span> : <p className="mt-2 text-sm font-semibold text-slate-700">{value}</p>}</div><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-xl text-indigo-500">{icon}</span></div>)}</section>;
}
