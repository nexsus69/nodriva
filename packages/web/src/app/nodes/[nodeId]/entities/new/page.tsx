'use client';

import React, { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { getTypeDefinitionAction } from '../../../../actions/typeActions';
import { useSemanticMetadata } from '../../../../hooks/useSemanticMetadata';
import { AppCache } from '../../../../cache/GlobalCacheClient';
import { GlobalViewStore } from '../../../../cache/ViewStore';
import { ViewKeyBuilder } from '../../../../cache/SemanticViewKey';
import { useLock } from '../../../../hooks/useLock';
import { LockBadge } from '../../../../components/LockBadge';

const NUMBER_TYPES = new Set(['number', 'integer', 'decimal', 'numeric', 'float', 'double']);

export default function CreateEntityPage() {
  const params = useParams();
  const router = useRouter();
  const parentNodeId = params.nodeId as string;

  const [isPending, startTransition] = useTransition();

  const { entityTypesList } = useSemanticMetadata();
  const [entityName, setEntityName] = useState('');
  const [entityDesc, setEntityDesc] = useState('');
  const [entityTypeKey, setEntityTypeKey] = useState('');
  const selectedEntityTypeKey = entityTypeKey || entityTypesList[0]?.typeKey || '';
  type TypeDefinition = NonNullable<Awaited<ReturnType<typeof getTypeDefinitionAction>>>;
  type DynamicField = TypeDefinition['fields'][number];
  const [fieldsDef, setFieldsDef] = useState<DynamicField[]>([]);
  const [payload, setPayload] = useState<Record<string, unknown>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { lockedByOther, isMyLock, acquireLock, releaseLock, error: lockError } = useLock({
    resourceType: 'node',
    resourceId: parentNodeId,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => void acquireLock(), 0);
    return () => window.clearTimeout(timer);
  }, [acquireLock]);

  useEffect(() => {
    if (selectedEntityTypeKey) {
      getTypeDefinitionAction('entity', selectedEntityTypeKey).then((def) => {
        if (def && def.fields) {
          setFieldsDef(def.fields);
          const initial: Record<string, unknown> = {};
          for (const f of def.fields) {
            initial[f.fieldKey] = f.dataType.toLowerCase() === 'boolean' ? false : '';
          }
          setPayload(initial);
        }
      });
    }
  }, [selectedEntityTypeKey]);

  const handleCreateEntity = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    startTransition(async () => {
      try {
        const processedPayload: Record<string, unknown> = {};
        for (const field of fieldsDef) {
          const val = payload[field.fieldKey];
          const dt = (field.dataType || '').toLowerCase();

          if (NUMBER_TYPES.has(dt)) {
            if (val === '' || val === null || val === undefined) {
              processedPayload[field.fieldKey] = null;
            } else {
              const num = Number(val);
              processedPayload[field.fieldKey] = Number.isNaN(num) ? val : num;
            }
          } else if (dt === 'boolean') {
            processedPayload[field.fieldKey] = Boolean(val);
          } else {
            processedPayload[field.fieldKey] = val;
          }
        }

        // Canonical Mutation
        await AppCache.createEntity({
          parentNodeId,
          entityTypeKey: selectedEntityTypeKey,
          name: entityName,
          description: entityDesc,
          payload: processedPayload,
        });

        // Invalidate Node Entity Collection Semantic View
        const listKey = ViewKeyBuilder.build({ viewType: 'NODE_ENTITY_COLLECTION', baseNodeId: parentNodeId });
        GlobalViewStore.delete(listKey);

        router.push(`/nodes/${parentNodeId}`);
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : 'Errore nella creazione dell\'entità.');
      }
    });
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <Link
        href={`/nodes/${parentNodeId}`}
        className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1 font-mono"
      >
        ← Torna al Nodo Padre
      </Link>

      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <span>🧩</span> Nuova Entità Operativa
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Crea una nuova entità compilando i dati di base ed i campi definiti dallo Schema.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
            {errorMsg}
          </div>
        )}
        <LockBadge
          lockedByOther={lockedByOther}
          isMyLock={isMyLock}
          acquireLock={acquireLock}
          releaseLock={releaseLock}
          error={lockError}
        />

        <form onSubmit={handleCreateEntity} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Tipo Entità *</label>
            <select
              value={selectedEntityTypeKey}
              onChange={(e) => setEntityTypeKey(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
            >
              {entityTypesList.map((t) => (
                <option key={t.id} value={t.typeKey}>
                  {t.name} ({t.typeKey})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Nome Entità *</label>
            <input
              type="text"
              required
              placeholder="es. Scheda Cliente Rossi"
              value={entityName}
              onChange={(e) => setEntityName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Descrizione</label>
            <textarea
              rows={2}
              placeholder="Descrizione opzionale..."
              value={entityDesc}
              onChange={(e) => setEntityDesc(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Form Dinamico Generato da Schema Definition */}
          {fieldsDef.length > 0 && (
            <div className="pt-4 border-t border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase font-mono tracking-wider">
                Campi Dinamici ({fieldsDef.length})
              </h3>
              {fieldsDef.map((field) => (
                <div key={field.fieldKey}>
                  <label className="block text-xs font-medium text-slate-400 mb-1 font-mono">
                    {field.fieldKey} {field.isRequired ? '*' : ''}
                  </label>
                  {field.dataType.toLowerCase() === 'boolean' ? (
                    <input
                      type="checkbox"
                      checked={Boolean(payload[field.fieldKey])}
                      onChange={(e) => setPayload({ ...payload, [field.fieldKey]: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-800 text-indigo-600 focus:ring-0"
                    />
                  ) : (
                    <input
                      type={NUMBER_TYPES.has(field.dataType.toLowerCase()) ? 'number' : 'text'}
                      step={field.dataType.toLowerCase() !== 'integer' ? 'any' : undefined}
                      required={field.isRequired}
                      value={String(payload[field.fieldKey] ?? '')}
                      onChange={(e) => setPayload({ ...payload, [field.fieldKey]: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/80">
            <Link
              href={`/nodes/${parentNodeId}`}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            >
              Annulla
            </Link>
            <button
              type="submit"
              disabled={isPending || !entityName || !selectedEntityTypeKey || !isMyLock}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 disabled:opacity-50"
            >
              {isPending ? 'Salvataggio...' : 'Crea Entità'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
