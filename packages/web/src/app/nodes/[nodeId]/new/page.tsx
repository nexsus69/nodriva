'use client';

import React, { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useSemanticMetadata } from '../../../hooks/useSemanticMetadata';
import { AppCache } from '../../../cache/GlobalCacheClient';
import { GlobalViewStore } from '../../../cache/ViewStore';
import { ViewKeyBuilder } from '../../../cache/SemanticViewKey';
import { useLock } from '../../../hooks/useLock';
import { LockBadge } from '../../../components/LockBadge';
import { PageShell, Panel } from '../../../components/ui/layout';
import { Alert } from '../../../components/ui/feedback';
import { DynamicFieldsForm, EnumOptionModal, type DynamicField } from '../../../components/ui/forms';

export default function CreateChildNodePage() {
  const params = useParams();
  const router = useRouter();
  const parentNodeId = params.nodeId as string;

  const { nodeTypesList } = useSemanticMetadata();
  const [isPending, startTransition] = useTransition();

  const [nodeName, setNodeName] = useState('');
  const [nodeDesc, setNodeDesc] = useState('');
  const [nodeTypeKey, setNodeTypeKey] = useState('');
  const NUMBER_TYPES = new Set(['number', 'integer', 'decimal', 'numeric', 'float', 'double']);
  const [fieldsDef, setFieldsDef] = useState<DynamicField[]>([]);
  const [payload, setPayload] = useState<Record<string, unknown>>({});
  const [enumField, setEnumField] = useState<DynamicField | null>(null);
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
    if (!nodeTypeKey && nodeTypesList.length > 0) {
      const timer = window.setTimeout(() => setNodeTypeKey(nodeTypesList[0]!.typeKey), 0);
      return () => window.clearTimeout(timer);
    }
    if (!nodeTypeKey) return;
    const timer = window.setTimeout(() => {
      AppCache.admin.getTypeDefinition('node', nodeTypeKey).then((definition) => {
        const fields = definition?.fields ?? [];
        setFieldsDef(fields);
        const initial: Record<string, unknown> = {};
        for (const field of fields) initial[field.fieldKey] = field.dataType.toLowerCase() === 'boolean' ? false : '';
        setPayload(initial);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [nodeTypeKey, nodeTypesList]);

  const handleCreateNode = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    startTransition(async () => {
      try {
        const processedPayload = { ...payload };
        for (const field of fieldsDef) {
          if (NUMBER_TYPES.has(field.dataType.toLowerCase()) && processedPayload[field.fieldKey] !== '') {
            const numberValue = Number(processedPayload[field.fieldKey]);
            if (!Number.isNaN(numberValue)) processedPayload[field.fieldKey] = numberValue;
          }
        }
        await AppCache.createNode({
          parentNodeId,
          nodeTypeKey,
          name: nodeName,
          description: nodeDesc,
          payload: processedPayload,
        });

        const listKey = ViewKeyBuilder.build({ viewType: 'SUBTREE_LIST', baseNodeId: parentNodeId });
        GlobalViewStore.delete(listKey);

        router.push(`/nodes/${parentNodeId}`);
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : 'Errore nella creazione del nodo.');
      }
    });
  };

  return (
    <PageShell className="max-w-xl">
      {/* Breadcrumb */}
      <Link
        href={`/nodes/${parentNodeId}`}
        className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1 font-mono"
      >
        ← Torna al Nodo Padre
      </Link>

      <Panel className="space-y-6 border-slate-800 bg-slate-900 text-slate-100">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <span>🌿</span> Crea Nuovo Sotto-Nodo
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Aggiunge un elemento figlio alla gerarchia sotto il nodo corrente.
          </p>
        </div>

        {errorMsg && <Alert tone="danger" className="bg-rose-500/10 text-rose-300">{errorMsg}</Alert>}
        <LockBadge
          lockedByOther={lockedByOther}
          isMyLock={isMyLock}
          acquireLock={acquireLock}
          releaseLock={releaseLock}
          error={lockError}
        />

        <form onSubmit={handleCreateNode} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Tipo Nodo *</label>
            <select
              value={nodeTypeKey}
              onChange={(e) => setNodeTypeKey(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
            >
              {nodeTypesList.map((t) => (
                <option key={t.id} value={t.typeKey}>
                  {t.name} ({t.typeKey})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Nome Nodo *</label>
            <input
              type="text"
              required
              placeholder="es. Nome del nodo"
              value={nodeName}
              onChange={(e) => setNodeName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Descrizione</label>
            <textarea
              rows={3}
              placeholder="Descrizione opzionale..."
              value={nodeDesc}
              onChange={(e) => setNodeDesc(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <DynamicFieldsForm
            fields={fieldsDef}
            payload={payload}
            setPayload={setPayload}
            onAddEnumOption={setEnumField}
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/80">
            <Link
              href={`/nodes/${parentNodeId}`}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            >
              Annulla
            </Link>
            <button
              type="submit"
              disabled={isPending || !nodeName || !isMyLock}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 disabled:opacity-50"
            >
              {isPending ? 'Creazione...' : 'Crea Sotto-Nodo'}
            </button>
          </div>
        </form>
      </Panel>
      {enumField && (
        <EnumOptionModal
          kind="node"
          typeKey={nodeTypeKey}
          fieldId={enumField.id!}
          onClose={() => setEnumField(null)}
          onError={setErrorMsg}
          onOptionAdded={(option) => setFieldsDef((current) => current.map((field) => field.id === enumField.id ? { ...field, enumOptions: [...(field.enumOptions ?? []), option] } : field))}
        />
      )}
    </PageShell>
  );
}
