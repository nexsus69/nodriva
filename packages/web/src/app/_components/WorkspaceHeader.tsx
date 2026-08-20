import Link from '@/app/components/navigation/GuardedLink';
import { Skeleton } from '@/app/components/ui/feedback';

export function WorkspaceHeader() {
  return <section className="relative overflow-hidden rounded-[2rem] border border-indigo-100 bg-gradient-to-br from-white via-indigo-50/60 to-violet-50 p-7 shadow-xl shadow-slate-200/70 sm:p-9"><div className="relative flex flex-col justify-between gap-8 lg:flex-row lg:items-end"><div className="max-w-2xl space-y-4"><div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-300/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-700">● Workspace operativo</div><div><h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Il tuo spazio di lavoro.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">Esplora la struttura aziendale e accedi rapidamente a ordini, entità, clienti e sotto-nodi.</p></div></div><Link href="/admin" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm">⚙ Centro di controllo</Link></div></section>;
}

export function WorkspaceStats({ checking, loading, seeded, nodeCount }: { checking: boolean; loading: boolean; seeded: boolean; nodeCount: number }) {
  const cards = [
    { label: 'Nodi radice', value: checking || loading ? null : String(nodeCount), loadingLabel: 'Caricamento numero nodi radice', icon: '⌘' },
    { label: 'Stato sistema', value: checking ? null : seeded ? 'Operativo' : 'Configurazione richiesta', loadingLabel: 'Verifica stato sistema', icon: '●' },
    { label: 'Accesso', value: 'Sessione protetta', loadingLabel: '', icon: '✓' },
  ];
  return <section aria-label="Riepilogo workspace" className="grid grid-cols-1 gap-3 sm:grid-cols-3">{cards.map(({ label, value, loadingLabel, icon }) => <div key={label} className="glass-panel flex items-center justify-between rounded-2xl border border-slate-200 p-5 shadow-sm"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>{value === null ? <span role="status" aria-label={loadingLabel} className="mt-2 block"><Skeleton className="h-4 w-28" /></span> : <p className="mt-2 text-sm font-semibold text-slate-700">{value}</p>}</div><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-xl text-indigo-500">{icon}</span></div>)}</section>;
}
