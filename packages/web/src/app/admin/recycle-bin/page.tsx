'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { AppCache } from '../../cache/GlobalCacheClient';
import type { DeletedEntityListItem, DeletedNodeListItem } from '../../actions/recycleActions';

type PendingAction =
  | { kind: 'restore-entity'; item: DeletedEntityListItem }
  | { kind: 'purge-entity'; item: DeletedEntityListItem }
  | { kind: 'restore-node'; item: DeletedNodeListItem }
  | { kind: 'purge-node'; item: DeletedNodeListItem };

export default function RecycleBinPage() {
  const [items, setItems] = useState<DeletedEntityListItem[]>([]);
  const [nodes, setNodes] = useState<DeletedNodeListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [confirmationText, setConfirmationText] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    void Promise.all([AppCache.admin.listDeletedEntities(), AppCache.admin.listDeletedNodes()]).then(([entities, deletedNodes]) => {
      if (entities.success) setItems(entities.data);
      else setError(entities.error.message ?? 'Impossibile caricare le entità eliminate.');
      if (deletedNodes.success) setNodes(deletedNodes.data);
      else setError(deletedNodes.error.message ?? 'Impossibile caricare i nodi eliminati.');
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const restore = (item: DeletedEntityListItem) => setPendingAction({ kind: 'restore-entity', item });

  const purge = (item: DeletedEntityListItem) => {
    setConfirmationText('');
    setPendingAction({ kind: 'purge-entity', item });
  };

  const restoreNode = (item: DeletedNodeListItem) => setPendingAction({ kind: 'restore-node', item });

  const purgeNode = (item: DeletedNodeListItem) => {
    setConfirmationText('');
    setPendingAction({ kind: 'purge-node', item });
  };

  const closeActionModal = () => {
    if (isPending) return;
    setPendingAction(null);
    setConfirmationText('');
  };

  const confirmAction = () => {
    if (!pendingAction) return;
    const action = pendingAction;
    const isPurge = action.kind === 'purge-entity' || action.kind === 'purge-node';
    if (isPurge && confirmationText !== 'ELIMINA DEFINITIVAMENTE') return;
    setPendingAction(null);
    setConfirmationText('');
    startTransition(() => {
      if (action.kind === 'restore-entity') {
        void AppCache.admin.restoreDeletedEntity({ entityId: action.item.id, expectedRowVersion: action.item.rowVersion }).then((result) => {
          if (!result.success) setError(result.error?.message ?? 'Ripristino non riuscito.');
          else load();
        });
      } else if (action.kind === 'purge-entity') {
        void AppCache.admin.purgeDeletedEntity({ entityId: action.item.id, confirmation: 'ELIMINA DEFINITIVAMENTE' }).then((result) => {
          if (!result.success) setError(result.error.message ?? 'Eliminazione definitiva non riuscita.');
          else load();
        });
      } else if (action.kind === 'restore-node') {
        void AppCache.admin.restoreDeletedNode({ nodeId: action.item.id, expectedRowVersion: action.item.rowVersion }).then((result) => {
          if (!result.success) setError(result.error?.message ?? 'Ripristino del sottoalbero non riuscito.');
          else load();
        });
      } else {
        void AppCache.admin.purgeDeletedNode({ nodeId: action.item.id, confirmation: 'ELIMINA DEFINITIVAMENTE' }).then((result) => {
          if (!result.success) setError(result.error.message ?? 'Purge del sottoalbero non riuscito.');
          else load();
        });
      }
    });
  };

  const pendingIsPurge = pendingAction?.kind === 'purge-entity' || pendingAction?.kind === 'purge-node';
  const pendingIsNode = pendingAction?.kind === 'restore-node' || pendingAction?.kind === 'purge-node';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">Lifecycle management</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Cestino e ripristino</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">Visualizzi solo le risorse eliminate all’interno degli scope per cui possiedi il permesso di ripristino.</p>
        </div>
        <button type="button" onClick={load} disabled={loading || isPending} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50">↻ Aggiorna</button>
      </div>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="text-sm font-semibold text-slate-900">Entità eliminate <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{items.length}</span></h2></div>
        {loading ? <div className="p-8 text-center text-sm text-slate-500">Caricamento…</div> : items.length === 0 ? <div className="p-10 text-center"><div className="text-3xl">🗃️</div><p className="mt-3 text-sm text-slate-400">Nessun elemento eliminato nello scope corrente.</p></div> : (
          <div className="divide-y divide-slate-200">
            {items.map((item) => <div key={item.id} className="flex flex-col gap-4 px-5 py-4 transition-colors hover:bg-slate-50 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0"><div className="flex items-center gap-2"><h3 className="truncate text-sm font-semibold text-slate-900">{item.name}</h3><span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">Eliminata</span>{!item.entityTypeActive && <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">Tipo disabilitato</span>}</div><p className="mt-1 text-xs text-slate-600">{item.entityTypeName} · Nodo: {item.parentNodeName}</p><p className="mt-1 text-[11px] text-slate-500">Eliminata il {new Date(item.deletedAt).toLocaleString('it-IT')} · versione {item.rowVersion}</p></div>
              <div className="flex shrink-0 gap-2"><button type="button" onClick={() => restore(item)} disabled={isPending || !item.entityTypeActive} title={!item.entityTypeActive ? 'Riattiva prima il tipo di entità' : undefined} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-emerald-900/20 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">{item.entityTypeActive ? 'Ripristina' : 'Tipo disabilitato'}</button><button type="button" onClick={() => purge(item)} disabled={isPending} className="rounded-xl border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Purge</button></div>
            </div>)}
          </div>
        )}
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="text-sm font-semibold text-slate-900">Sottoalberi eliminati <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{nodes.length}</span></h2></div>
        {!loading && nodes.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">Nessun sottoalbero eliminato nello scope corrente.</div> : <div className="divide-y divide-slate-200">{nodes.map((item) => <div key={item.id} className="flex flex-col gap-4 px-5 py-4 hover:bg-slate-50 md:flex-row md:items-center md:justify-between"><div><div className="flex items-center gap-2"><h3 className="text-sm font-semibold text-slate-900">{item.name}</h3><span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">Sottoalbero</span></div><p className="mt-1 text-xs text-slate-600">{item.nodeTypeName} · percorso {item.path}</p><p className="mt-1 text-[11px] text-slate-500">Eliminato il {new Date(item.deletedAt).toLocaleString('it-IT')} · versione {item.rowVersion}</p></div><div className="flex shrink-0 gap-2"><button type="button" onClick={() => restoreNode(item)} disabled={isPending} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">Ripristina sottoalbero</button><button type="button" onClick={() => purgeNode(item)} disabled={isPending} className="rounded-xl border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Purge</button></div></div>)}</div>}
      </div>
      <p className="text-[11px] text-slate-500">Il purge richiede permessi separati, viene registrato nell’audit e richiede una conferma esplicita.</p>

      {pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="recycle-action-title">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">Cestino</p>
                <h2 id="recycle-action-title" className="mt-2 text-lg font-semibold text-slate-900">{pendingIsPurge ? 'Eliminazione definitiva' : 'Conferma ripristino'}</h2>
              </div>
              <button type="button" onClick={closeActionModal} disabled={isPending} className="text-slate-400 hover:text-slate-700 disabled:opacity-50" aria-label="Chiudi">✕</button>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              {pendingIsPurge
                ? `L’operazione eliminerà definitivamente “${pendingAction.item.name}”${pendingIsNode ? ', le entità, gli allegati e i dati cifrati contenuti' : ', inclusi gli allegati e i dati cifrati associati'}. Questa azione non può essere annullata.`
                : `Ripristinare “${pendingAction.item.name}”${pendingIsNode ? ' e tutto il sottoalbero associato' : ''}?`}
            </p>
            {pendingIsPurge && (
              <label className="mt-5 block text-sm font-medium text-slate-700">
                Digita <span className="font-semibold text-rose-700">ELIMINA DEFINITIVAMENTE</span> per continuare.
                <input value={confirmationText} onChange={(event) => setConfirmationText(event.target.value)} autoFocus className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-emerald-500 focus:ring-2" />
              </label>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={closeActionModal} disabled={isPending} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Annulla</button>
              <button type="button" onClick={confirmAction} disabled={isPending || (pendingIsPurge && confirmationText !== 'ELIMINA DEFINITIVAMENTE')} className={`rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50 ${pendingIsPurge ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>{pendingIsPurge ? 'Elimina definitivamente' : 'Ripristina'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
