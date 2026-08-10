'use client';

import React, { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useSemanticEntityDetail } from '../../../../hooks/useSemanticEntityDetail';
import { AppCache } from '../../../../cache/GlobalCacheClient';
import { GlobalViewStore } from '../../../../cache/ViewStore';
import { ViewKeyBuilder } from '../../../../cache/SemanticViewKey';
import { useLock } from '../../../../hooks/useLock';
import { LockBadge } from '../../../../components/LockBadge';
import { ConfirmModal } from '../../../../components/ui/ConfirmModal';
import { NodeBreadcrumb } from '../../../../components/navigation/NodeBreadcrumb';
import { LockIndicator } from '../../../../components/LockIndicator';
import { useSemanticMetadata } from '../../../../hooks/useSemanticMetadata';
import { useSemanticEntityCollection } from '../../../../hooks/useSemanticEntityCollection';
import { PageShell, Panel } from '../../../../components/ui/layout';
import { LoadingState } from '../../../../components/ui/feedback';
import { EntityResourceMenu } from '../../../../components/ui/menu';
import { AttachmentInput, AttachmentList, DynamicFieldsForm, type DynamicField } from '../../../../components/ui/forms';
import { uploadResourceAttachment } from '../../../../attachments/attachmentClient';

const NUMBER_TYPES = new Set(['number', 'integer', 'decimal', 'numeric', 'float', 'double']);

export default function EntityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const parentNodeId = params.nodeId as string;
  const entityId = params.entityId as string;

  const { entity, isLoading, isError, error } = useSemanticEntityDetail(entityId, parentNodeId);
  const { entities: siblingEntities } = useSemanticEntityCollection(parentNodeId);
  const { entityTypes, entityTypesList } = useSemanticMetadata();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<DynamicField[]>([]);
  const [payload, setPayload] = useState<Record<string, unknown>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [attachments, setAttachments] = useState<readonly File[]>([]);
  const {
    lockedByOther,
    isMyLock,
    acquireLock,
    releaseLock,
    error: lockError,
  } = useLock({ resourceType: 'entity', resourceId: entityId });

  const entityType = entity ? entityTypes[entity.entityTypeId] : undefined;

  const relationCandidates = (field: DynamicField) => {
    if (field.relationTargetDomain !== 'entity' || !field.relationTargetTypeKey) return [];
    const targetType = entityTypes[field.relationTargetTypeKey];
    return siblingEntities.filter((candidate) => (
      candidate.entityTypeId === field.relationTargetTypeKey
      || candidate.entityTypeId === targetType?.id
    ));
  };

  useEffect(() => {
    if (!entity || !entityType?.typeKey) return;
    const timer = window.setTimeout(() => {
      void AppCache.admin.getTypeDefinition('entity', entityType.typeKey).then((definition) => {
        setFields(definition?.fields ?? []);
        setPayload(entity.payload ?? {});
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [entity, entityType?.typeKey]);


  const beginEditing = async (): Promise<boolean> => {
    if (!entity) return false;
    setName(entity.name || '');
    setDescription(entity.description || '');
    setPayload(entity.payload || {});
    setAttachments([]);
    return await acquireLock();
  };

  const handleSaveEntity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entity) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      try {
        const processedPayload = { ...entity.payload, ...payload };
        for (const field of fields) {
          const value = processedPayload[field.fieldKey];
          if (value === '' && !field.isRequired) {
            processedPayload[field.fieldKey] = null;
          } else if (NUMBER_TYPES.has(field.dataType.toLowerCase()) && value !== '') {
            const parsed = Number(value);
            if (!Number.isNaN(parsed)) processedPayload[field.fieldKey] = parsed;
          }
        }

        await AppCache.updateEntity({
          entityId,
          name,
          description,
          payloadDelta: processedPayload,
          expectedRowVersion: entity.rowVersion,
        });
        for (const file of attachments) {
          await uploadResourceAttachment({ resourceType: 'entity', resourceId: entityId, fieldKey: 'attachments', kind: file.type.startsWith('image/') ? 'image' : 'file', file });
        }

        await releaseLock();
        setSuccessMsg('Entità aggiornata con successo.');
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : 'Errore durante l\'aggiornamento dell\'entità.');
      }
    });
  };

  const handleDeleteEntity = () => {
    if (!isMyLock || !entity) return;
    setShowDeleteConfirm(true);
  };

  const confirmDeleteEntity = () => {
    if (!entity) return;
    const entityTypeId = entity.entityTypeId;
    setShowDeleteConfirm(false);
    setErrorMsg(null);

    startTransition(async () => {
      try {
        await AppCache.deleteEntity(entityId, entityTypeId, entity.rowVersion);
        
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
      <PageShell className="max-w-xl">
        <Link
          href={`/nodes/${parentNodeId}`}
          className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1 font-mono"
        >
          ← Torna al Nodo Padre
        </Link>
        <Panel className="bg-slate-900 text-center text-slate-400">
          {isError ? `Errore: ${error?.message}` : <LoadingState label="Caricamento entità in corso…" />}
        </Panel>
      </PageShell>
    );
  }

  return (
    <PageShell className="max-w-2xl">
      <ConfirmModal
        open={showDeleteConfirm}
        title="Elimina entità"
        message="Sei sicuro di voler eliminare questa entità?"
        confirmLabel="Elimina"
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDeleteEntity}
        busy={isPending}
      />
      {/* Breadcrumb */}
      <div className="flex min-w-0 items-center gap-1">
        <NodeBreadcrumb nodeId={parentNodeId} currentNodeLinkable />
        <span aria-hidden="true" className="text-slate-600">/</span>
        <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-xs font-mono font-semibold leading-none text-slate-100" title={entity.name}>
          <span className="truncate">{entity.name}</span>
          <LockIndicator resourceType="entity" resourceId={entity.id} className="-translate-y-px" />
        </span>
      </div>

      {/* Header */}
      <Panel className="flex flex-col gap-4 border-slate-800 bg-slate-900 p-4 text-slate-100 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <span className="block break-all text-[10px] font-mono uppercase tracking-wider text-indigo-400">
            ID Entità: {entity.id}
          </span>
          <h1 className="mt-1 flex items-center gap-1 break-words text-xl font-bold text-slate-100"><span className="break-words">{entity.name}</span><EntityResourceMenu entityId={entity.id} entityName={entity.name} parentNodeId={parentNodeId} onEdit={() => { void beginEditing(); }} editDisabled={isMyLock} /></h1>
          <p className="mt-1 break-words text-xs text-slate-400">Tipo: {entityType?.name ?? entity.entityTypeId} (V: {entity.rowVersion})</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <LockBadge lockedByOther={lockedByOther} isMyLock={isMyLock} acquireLock={beginEditing} releaseLock={releaseLock} error={lockError} />
        </div>
      </Panel>

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
      <Panel className="space-y-6 border-slate-800 bg-slate-900 p-4 sm:p-6">
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
              <dt className="mb-2 text-slate-500">Campi</dt>
              <dd className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(fields.length > 0 ? fields : Object.keys(entity.payload ?? {}).map((fieldKey) => ({ fieldKey, label: fieldKey, dataType: 'string' }))).map((field) => {
                  const value = entity.payload?.[field.fieldKey];
                  const enumLabel = field.dataType === 'enum'
                    ? (field as DynamicField).enumOptions?.find((option) => option.value === String(value))?.label
                    : undefined;
                  return (
                    <div key={field.fieldKey} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500">{field.label ?? field.fieldKey}</div>
                      <div className={`mt-1 break-words text-slate-200 ${field.dataType === 'relation' ? 'font-mono text-[11px]' : ''}`}>
                        {field.dataType === 'relation' && typeof value === 'string' ? (() => {
                          const related = relationCandidates(field as DynamicField).find((candidate) => candidate.id === value);
                          return related
                            ? <Link href={`/nodes/${related.parentNodeId}/entities/${related.id}`} className="text-indigo-300 hover:text-indigo-200">{related.name} →</Link>
                            : value;
                        })() : value === null || value === undefined || value === '' ? '—' : typeof value === 'boolean' ? (value ? 'Sì' : 'No') : enumLabel ?? String(value)}
                      </div>
                    </div>
                  );
                })}
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

          <DynamicFieldsForm
            fields={fields}
            payload={payload}
            setPayload={setPayload}
            entityTypes={entityTypesList}
            siblingEntities={siblingEntities.filter((candidate) => candidate.id !== entity.id)}
          />

          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-300">Nuovi allegati</label>
            <AttachmentInput kind="file" maxFiles={10} maxSizeBytes={25 * 1024 * 1024} value={attachments} onChange={setAttachments} />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/80">
            <Link
              href="#"
              onClick={(event) => {
                event.preventDefault();
                setName(entity.name || '');
                setDescription(entity.description || '');
                setPayload(entity.payload || {});
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
      </Panel>
      <Panel className="space-y-3 border-slate-800 bg-slate-900 p-4 text-slate-100 sm:p-6">
        <h2 className="text-sm font-semibold">Allegati</h2>
        <AttachmentList resourceType="entity" resourceId={entityId} canDelete={isMyLock} />
      </Panel>
    </PageShell>
  );
}
