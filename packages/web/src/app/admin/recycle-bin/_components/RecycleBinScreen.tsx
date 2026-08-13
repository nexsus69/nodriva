'use client';

import { RecycleActionModal } from './RecycleActionModal';
import { RecycleResourceLists } from './RecycleResourceLists';
import { useRecycleBin } from '../_hooks/useRecycleBin';

export function RecycleBinScreen() {
  const controller = useRecycleBin();
  return <div className="space-y-6">
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm md:flex-row md:items-end md:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">Lifecycle management</p><h1 className="mt-2 text-2xl font-bold text-slate-900">Cestino e ripristino</h1><p className="mt-1 max-w-2xl text-sm text-slate-600">Risorse eliminate negli scope per cui possiedi il permesso di ripristino.</p></div><button type="button" onClick={() => void controller.load()} disabled={controller.loading || controller.isPending} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">↻ Aggiorna</button></div>
    {controller.error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{controller.error}</div>}
    <RecycleResourceLists entities={controller.entities} nodes={controller.nodes} loading={controller.loading} pending={controller.isPending} onAction={controller.requestAction} />
    <p className="text-[11px] text-slate-500">Il purge richiede permessi separati, viene registrato nell’audit e richiede una conferma esplicita.</p>
    {controller.pendingAction && <RecycleActionModal action={controller.pendingAction} confirmation={controller.confirmationText} pending={controller.isPending} onConfirmationChange={controller.setConfirmationText} onClose={controller.closeAction} onConfirm={controller.confirmAction} />}
  </div>;
}
