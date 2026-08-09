'use client';

import React, { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useSemanticMetadata } from '../../../../hooks/useSemanticMetadata';
import { AppCache } from '../../../../cache/GlobalCacheClient';
import { GlobalViewStore } from '../../../../cache/ViewStore';
import { ViewKeyBuilder } from '../../../../cache/SemanticViewKey';
import { useLock } from '../../../../hooks/useLock';
import { LockBadge } from '../../../../components/LockBadge';
import { useSemanticEntityCollection } from '../../../../hooks/useSemanticEntityCollection';
import { PageShell, Panel } from '../../../../components/ui/layout';
import { Alert } from '../../../../components/ui/feedback';
import { DynamicFieldsForm, EnumOptionModal, type DynamicField } from '../../../../components/ui/forms';

const NUMBER_TYPES = new Set(['number', 'integer', 'decimal', 'numeric', 'float', 'double']);

export default function CreateEntityPage() {
  const params = useParams();
  const router = useRouter();
  const parentNodeId = params.nodeId as string;

  const [isPending, startTransition] = useTransition();

  const { entityTypesList } = useSemanticMetadata();
  const { entities: siblingEntities } = useSemanticEntityCollection(parentNodeId);
  const [entityName, setEntityName] = useState('');
  const [entityDesc, setEntityDesc] = useState('');
  const [entityTypeKey, setEntityTypeKey] = useState('');
  const selectedEntityTypeKey = entityTypeKey || entityTypesList[0]?.typeKey || '';
  const [fieldsDef, setFieldsDef] = useState<DynamicField[]>([]);
  const [payload, setPayload] = useState<Record<string, unknown>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [relationField, setRelationField] = useState<DynamicField | null>(null);
  const [enumField, setEnumField] = useState<DynamicField | null>(null);
  const [relationFieldsDef, setRelationFieldsDef] = useState<DynamicField[]>([]);
  const [relationPayload, setRelationPayload] = useState<Record<string, unknown>>({});
  const [relationName, setRelationName] = useState('');
  const [relationDescription, setRelationDescription] = useState('');
  const [isCreatingRelation, setIsCreatingRelation] = useState(false);
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
      AppCache.admin.getTypeDefinition('entity', selectedEntityTypeKey).then((def) => {
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

  useEffect(() => {
    if (!relationField?.relationTargetTypeKey || relationField.relationTargetDomain !== 'entity') {
      return;
    }
    const timer = window.setTimeout(() => {
      AppCache.admin.getTypeDefinition('entity', relationField.relationTargetTypeKey!).then((definition) => {
        const fields = definition?.fields ?? [];
        setRelationFieldsDef(fields);
        const initial: Record<string, unknown> = {};
        for (const field of fields) {
          initial[field.fieldKey] = field.dataType.toLowerCase() === 'boolean' ? false : '';
        }
        setRelationPayload(initial);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [relationField]);

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
            <span>🧩</span> Nuova Entità Operativa
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Crea una nuova entità compilando i dati di base ed i campi definiti dallo Schema.
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

          <DynamicFieldsForm
            fields={fieldsDef}
            payload={payload}
            setPayload={setPayload}
            entityTypes={entityTypesList}
            siblingEntities={siblingEntities}
            onCreateRelation={(field) => {
              setRelationField(field);
              setRelationFieldsDef([]);
              setRelationPayload({});
              setRelationName('');
              setRelationDescription('');
              setErrorMsg(null);
            }}
            onAddEnumOption={setEnumField}
            title={`Campi Dinamici (${fieldsDef.length})`}
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
              disabled={isPending || !entityName || !selectedEntityTypeKey || !isMyLock}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 disabled:opacity-50"
            >
              {isPending ? 'Salvataggio...' : 'Crea Entità'}
            </button>
          </div>
        </form>
      </Panel>

      {relationField && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-5 rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-100">Nuova istanza collegata</h2>
                <p className="mt-1 text-xs text-slate-400">Crea l&apos;istanza target e usala automaticamente nella relazione.</p>
              </div>
              <button type="button" onClick={() => setRelationField(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                setErrorMsg(null);
                setIsCreatingRelation(true);
                void (async () => {
                  try {
                    if (!relationField?.relationTargetTypeKey) return;
                    const processedRelationPayload = { ...relationPayload };
                    for (const field of relationFieldsDef) {
                      if (NUMBER_TYPES.has(field.dataType.toLowerCase()) && processedRelationPayload[field.fieldKey] !== '') {
                        const numberValue = Number(processedRelationPayload[field.fieldKey]);
                        if (!Number.isNaN(numberValue)) processedRelationPayload[field.fieldKey] = numberValue;
                      }
                    }
                    const created = await AppCache.createEntity({
                      parentNodeId,
                      entityTypeKey: relationField.relationTargetTypeKey,
                      name: relationName.trim(),
                      description: relationDescription.trim(),
                      payload: processedRelationPayload,
                    });
                    setPayload((current) => ({ ...current, [relationField.fieldKey]: created.id }));
                    setRelationField(null);
                  } catch (error: unknown) {
                    setErrorMsg(error instanceof Error ? error.message : 'Impossibile creare l\'istanza collegata.');
                  } finally {
                    setIsCreatingRelation(false);
                  }
                })();
              }}
            >
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Nome *</label>
                <input required value={relationName} onChange={(event) => setRelationName(event.target.value)}
                  placeholder="es. Cliente Rossi" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Descrizione</label>
                <textarea value={relationDescription} onChange={(event) => setRelationDescription(event.target.value)} rows={2}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
              </div>
              <DynamicFieldsForm
                fields={relationFieldsDef}
                payload={relationPayload}
                setPayload={setRelationPayload}
                title="Campi dell&apos;istanza collegata"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setRelationField(null)} className="rounded-lg px-4 py-2 text-xs text-slate-300 hover:bg-slate-800">Annulla</button>
                <button type="submit" disabled={isCreatingRelation} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
                  {isCreatingRelation ? 'Creazione...' : 'Crea e seleziona'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {enumField && (
        <EnumOptionModal
          kind="entity"
          typeKey={selectedEntityTypeKey}
          fieldId={enumField.id!}
          onClose={() => setEnumField(null)}
          onError={setErrorMsg}
          onOptionAdded={(option) => setFieldsDef((current) => current.map((field) => field.id === enumField.id ? { ...field, enumOptions: [...(field.enumOptions ?? []), option] } : field))}
        />
      )}
    </PageShell>
  );
}
