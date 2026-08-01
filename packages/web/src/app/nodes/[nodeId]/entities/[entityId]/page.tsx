'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useSemanticEntityDetail } from '../../../../hooks/useSemanticEntityDetail';
import { AppCache } from '../../../../cache/GlobalCacheClient';
import { GlobalViewStore } from '../../../../cache/ViewStore';
import { ViewKeyBuilder } from '../../../../cache/SemanticViewKey';
import { useLock } from '../../../../hooks/useLock';
import { LockBadge } from '../../../../components/LockBadge';

export default function EntityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const parentNodeId = params.nodeId as string;
  const entityId = params.entityId as string;

  const { entity, isLoading, isError, error } = useSemanticEntityDetail(entityId, parentNodeId);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [payloadJsonText, setPayloadJsonText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const {
    lockedByOther,
    isMyLock,
    acquireLock,
    releaseLock,
    error: lockError,
  } = useLock({ resourceType: 'entity', resourceId: entityId });

  const beginEditing = async (): Promise<boolean> => {
    if (!entity) return false;
    setName(entity.name || '');
    setDescription(entity.description || '');
    setPayloadJsonText(JSON.stringify(entity.payload || {}, null, 2));
    return await acquireLock();
  };

  const handleSaveEntity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entity) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      try {
        let parsedPayload = {};
        if (payloadJsonText) {
          parsedPayload = JSON.parse(payloadJsonText);
        }

        await AppCache.updateEntity({
          entityId,
          name,
          description,
          payloadDelta: parsedPayload,
          expectedRowVersion: entity.rowVersion,
        });

        await releaseLock();
        setSuccessMsg('Entità aggiornata con successo.');
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : 'Errore durante l\'aggiornamento dell\'entità.');
      }
    });
  };

  const handleDeleteEntity = () => {
    if (!isMyLock || !entity) return;
    const entityTypeId = entity.entityTypeId;
    if (!confirm('Sei sicuro di voler eliminare questa entità?')) return;
    setErrorMsg(null);

    startTransition(async () => {
      try {
        await AppCache.deleteEntity(entityId, entityTypeId);
        
        // Invalidate Node Entity Collection Semantic View
        const listKey = ViewKeyBuilder.build({ viewType: 'NODE_ENTITY_COLLECTION', baseNodeId: parentNodeId });
        GlobalViewStore.delete(listKey);

        router.push(`/nodes/${parentNodeId}`);
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : 'Errore durante l\'eliminazione.');
      }
    });
  };

  if (isLoading || !entity) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <Link
          href={`/nodes/${parentNodeId}`}
          className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1 font-mono"
        >
          ← Torna al Nodo Padre
        </Link>
        <div className="glass-panel p-8 text-center text-xs text-slate-400 rounded-2xl">
          {isError ? `Errore: ${error?.message}` : 'Caricamento entità in corso dal nuovo engine...'}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <Link
        href={`/nodes/${parentNodeId}`}
        className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1 font-mono"
      >
        ← Torna al Nodo Padre
      </Link>

      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-wider block">
            ID Entità: {entity.id}
          </span>
          <h1 className="text-xl font-bold text-slate-100">{entity.name}</h1>
          <p className="text-xs text-slate-400 mt-1">Tipo: {entity.entityTypeId} (V: {entity.rowVersion})</p>
        </div>

        <LockBadge
          lockedByOther={lockedByOther}
          isMyLock={isMyLock}
          acquireLock={beginEditing}
          releaseLock={releaseLock}
          error={lockError}
        />
      </div>

      {/* Feedback Messages */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
          <span className="font-bold">Errore:</span> {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
          <span className="font-bold">Esito:</span> {successMsg}
        </div>
      )}
      {lockError && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
          {lockError}
        </div>
      )}

      {/* View mode never opens a lock or a Pusher subscription. */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
        {!isMyLock ? (
          <dl className="space-y-4 text-xs">
            <div>
              <dt className="text-slate-500 mb-1">Nome</dt>
              <dd className="text-slate-100">{entity.name}</dd>
            </div>
            <div>
              <dt className="text-slate-500 mb-1">Descrizione</dt>
              <dd className="text-slate-300">{entity.description || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500 mb-1">Payload</dt>
              <dd>
                <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-indigo-300 overflow-auto">
                  {JSON.stringify(entity.payload || {}, null, 2)}
                </pre>
              </dd>
            </div>
          </dl>
        ) : (
        <form onSubmit={handleSaveEntity} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Nome Entità *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Descrizione</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1 font-mono">
              Payload JSON (Campi Custom)
            </label>
            <textarea
              rows={8}
              value={payloadJsonText}
              onChange={(e) => setPayloadJsonText(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-indigo-300 font-mono focus:outline-none focus:border-indigo-500 leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/80">
            <Link
              href="#"
              onClick={(event) => {
                event.preventDefault();
                setName(entity.name || '');
                setDescription(entity.description || '');
                setPayloadJsonText(JSON.stringify(entity.payload || {}, null, 2));
                void releaseLock();
              }}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            >
              Annulla
            </Link>
            <button
              type="button"
              onClick={handleDeleteEntity}
              disabled={isPending}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 disabled:opacity-50"
            >
              Elimina
            </button>
            <button
              type="submit"
              disabled={isPending || !name}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 disabled:opacity-50"
            >
              {isPending ? 'Salvataggio...' : 'Salva Modifiche'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
