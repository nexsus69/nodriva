'use client';

import React, { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSemanticNodeList } from '../../hooks/useSemanticNodeList';
import { useSemanticEntityCollection } from '../../hooks/useSemanticEntityCollection';
import { useSemanticMetadata } from '../../hooks/useSemanticMetadata';
import { AppCache } from '../../cache/GlobalCacheClient';
import { useCacheNode } from '../../hooks/useCacheNode';
import { LockBadge } from '../../components/LockBadge';
import { NodeTree } from '../../components/navigation/NodeTree';
import { NodeBreadcrumb } from '../../components/navigation/NodeBreadcrumb';
import { useLock } from '../../hooks/useLock';
import { NodeEntityGrid } from './_components/NodeEntityGrid';
import { SubtreeEntitiesTableSection } from './_components/SubtreeEntitiesTableSection';
import { PageShell, Panel, SectionHeader } from '../../components/ui/layout';
import { Alert } from '../../components/ui/feedback';
import { NodeResourceMenu } from '../../components/ui/menu';
import { AttachmentInput, AttachmentList, DynamicFieldsForm } from '../../components/ui/forms';
import { uploadResourceAttachment } from '../../attachments/attachmentClient';

export default function NodeDetailPage() {
  const params = useParams();
  const nodeId = params.nodeId as string;

  const { nodes: childNodes, error: childrenError } = useSemanticNodeList(nodeId, {
    retentionClass: 'persistent',
  });
  const { entities: nodeEntities, isLoading: isEntitiesLoading, error: entitiesError } = useSemanticEntityCollection(nodeId);
  const { entityTypes, nodeTypes } = useSemanticMetadata();

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSavingNode, startNodeUpdate] = useTransition();
  const [nodeName, setNodeName] = useState('');
  const [nodeDescription, setNodeDescription] = useState('');
  type DynamicNodeField = NonNullable<Awaited<ReturnType<typeof AppCache.admin.getTypeDefinition>>>['fields'][number];
  type EntityTypeDefinition = NonNullable<Awaited<ReturnType<typeof AppCache.admin.getTypeDefinition>>>;
  const [dynamicNodeFields, setDynamicNodeFields] = useState<DynamicNodeField[]>([]);
  const [dynamicNodePayload, setDynamicNodePayload] = useState<Record<string, unknown>>({});
  const [attachmentsByField, setAttachmentsByField] = useState<Record<string, readonly File[]>>({});
  const [entityDefinitions, setEntityDefinitions] = useState<Record<string, EntityTypeDefinition>>({});

  const entityTypeKeysSignature = [...new Set(
    nodeEntities.map((entity) => entityTypes[entity.entityTypeId]?.typeKey).filter(Boolean)
  )].sort().join('|');

  // --- LOCK STATE ---
  const { lockedByOther, isMyLock, acquireLock, releaseLock, error: lockError } = useLock({ resourceType: 'node', resourceId: nodeId });
  const readOnly = !isMyLock;

  // --- REACTIVE READS FROM APPCACHE ---
  const { data: cachedCurrentNode, isLoading: isLoadingNode } = useCacheNode(nodeId);
  const currentNode = cachedCurrentNode;

  useEffect(() => {
    const nodeTypeKey = currentNode ? nodeTypes[currentNode.nodeTypeId]?.typeKey : undefined;
    if (!currentNode || !nodeTypeKey) return;
    const node = currentNode;
    const timer = window.setTimeout(() => {
      AppCache.admin.getTypeDefinition('node', nodeTypeKey).then((definition) => {
        setDynamicNodeFields(definition?.fields ?? []);
        setDynamicNodePayload(node.payload ?? {});
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [currentNode, nodeTypes]);

  useEffect(() => {
    const typeKeys = entityTypeKeysSignature ? entityTypeKeysSignature.split('|') : [];
    if (typeKeys.length === 0) return;
    let cancelled = false;
    Promise.all(typeKeys.map((typeKey) => AppCache.admin.getTypeDefinition('entity', typeKey)))
      .then((definitions) => {
        if (cancelled) return;
        setEntityDefinitions(Object.fromEntries(
          definitions.filter((definition): definition is EntityTypeDefinition => Boolean(definition))
            .map((definition) => [definition.typeKey, definition])
        ));
      })
      .catch((error: unknown) => {
        if (!cancelled) AppCache.handleFetchError(error);
      });
    return () => { cancelled = true; };
  }, [entityTypeKeysSignature]);
  
  // Combine readModel pending fetch with cache pending fetch
  const isNodeLoading = isLoadingNode || !currentNode;


  const beginNodeEditing = async (): Promise<boolean> => {
    if (!currentNode) return false;
    setErrorMsg(null);
    setSuccessMsg(null);
    setNodeName(currentNode.name);
    setNodeDescription(currentNode.description || '');
    setAttachmentsByField({});
    return await acquireLock();
  };

  const exitEditMode = async () => {
    if (currentNode) {
      setNodeName(currentNode.name);
      setNodeDescription(currentNode.description || '');
    }
    await releaseLock();
  };

  const handleUpdateNode = (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentNode || !isMyLock) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    startNodeUpdate(async () => {
      try {
        await AppCache.updateNode({
          nodeId,
          name: nodeName.trim(),
          description: nodeDescription.trim(),
          expectedRowVersion: currentNode.rowVersion,
          payloadDelta: dynamicNodePayload,
        });
        for (const field of dynamicNodeFields.filter((candidate) => ['file', 'image'].includes(candidate.dataType.toLowerCase()))) {
          for (const file of attachmentsByField[field.fieldKey] ?? []) {
            await uploadResourceAttachment({ resourceType: 'node', resourceId: nodeId, fieldKey: field.fieldKey, kind: field.dataType.toLowerCase() as 'file' | 'image', file });
          }
        }
        await releaseLock();
        setSuccessMsg('Nodo aggiornato con successo.');
      } catch (error: unknown) {
        setErrorMsg(
          error instanceof Error
            ? `Errore durante l'aggiornamento del nodo: ${error.message}`
            : `Errore durante l'aggiornamento del nodo.`
        );
      }
    });
  };

  const displayedError =
    errorMsg ??
    (childrenError
      ? `Errore nel caricamento del nodo: ${childrenError.message}`
      : entitiesError
        ? `Errore nel caricamento delle entità: ${entitiesError.message}`
        : null);

  return (
    <PageShell>
      {/* Breadcrumb / Navigazione Superiore */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <NodeBreadcrumb nodeId={nodeId} />

        <div className="flex items-center gap-2">
          {!readOnly && (
            <>
              <Link
                href={`/nodes/${nodeId}/new`}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-all hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
              >
                <span>➕</span> Sotto-Nodo
              </Link>
              <Link
                href={`/nodes/${nodeId}/entities/new`}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 transition-all hover:bg-indigo-500"
              >
                <span>➕</span> Nuova Entità
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <NodeTree
          activeNodeId={nodeId}
          activeNodePath={currentNode?.path}
        />
        <Panel as="aside">
          <SectionHeader title="Riepilogo nodo" description="Contesto" actions={<span className={`h-2.5 w-2.5 rounded-full ${isMyLock ? 'bg-emerald-500' : lockedByOther ? 'bg-amber-500' : 'bg-slate-300'}`} title={isMyLock ? 'Modifica attiva' : lockedByOther ? 'Bloccato da altro utente' : 'Sola lettura'} />} />
          <dl className="mt-4 space-y-4 text-xs">
            <div><dt className="text-[10px] uppercase tracking-wider text-slate-400">Nodo corrente</dt><dd className="mt-1 truncate font-semibold text-slate-800">{currentNode?.name || 'Caricamento…'}</dd></div>
            <div className="grid grid-cols-2 gap-3"><div><dt className="text-[10px] uppercase tracking-wider text-slate-400">Sotto-nodi</dt><dd className="mt-1 text-lg font-semibold text-slate-800">{childNodes.length}</dd></div><div><dt className="text-[10px] uppercase tracking-wider text-slate-400">Entità</dt><dd className="mt-1 text-lg font-semibold text-slate-800">{nodeEntities.length}</dd></div></div>
            <div className="border-t border-slate-100 pt-3"><dt className="text-[10px] uppercase tracking-wider text-slate-400">Modalità</dt><dd className="mt-1 font-medium text-slate-600">{isMyLock ? 'Modifica autorizzata' : lockedByOther ? 'Bloccato temporaneamente' : 'Sola lettura'}</dd></div>
          </dl>
        </Panel>
      </div>

      {/* Messaggi Feedback */}
      {displayedError && (
        <Alert tone="danger"><span className="font-bold">Errore:</span> {displayedError}</Alert>
      )}
      {successMsg && (
        <Alert tone="success"><span className="font-bold">Esito:</span> {successMsg}</Alert>
      )}

      {/* Testata Nodo Selezionato */}
      <Panel className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-xl text-indigo-600">
              📦
            </div>
            <div>
              <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
                {isNodeLoading && (
                  <svg className="animate-spin h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                <span className="min-w-0 break-words">{currentNode?.name || 'Caricamento...'}</span>
                {currentNode && <NodeResourceMenu nodeId={currentNode.id} nodeName={currentNode.name} onEdit={() => { void beginNodeEditing(); }} />}
              </h1>
              <p className="mt-0.5 text-xs font-mono text-slate-400">
                Path: {currentNode?.pathLabel || currentNode?.path || '-'}
              </p>
            </div>
            <DynamicFieldsForm
              fields={dynamicNodeFields}
              payload={dynamicNodePayload}
              setPayload={setDynamicNodePayload}
              title="Campi dinamici"
            />
            {isMyLock && dynamicNodeFields.filter((field) => ['file', 'image'].includes(field.dataType.toLowerCase())).map((field) => {
              const kind = field.dataType.toLowerCase() as 'file' | 'image';
              return <div key={field.fieldKey} className="mt-3 space-y-2"><label className="block text-xs font-medium text-slate-700">{field.label ?? field.fieldKey}</label><AttachmentInput kind={kind} maxFiles={10} maxSizeBytes={25 * 1024 * 1024} value={attachmentsByField[field.fieldKey] ?? []} onChange={(files) => setAttachmentsByField((current) => ({ ...current, [field.fieldKey]: files }))} /></div>;
            })}
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-mono uppercase text-slate-500">
              Version {currentNode?.rowVersion || 1}
            </span>
            <LockBadge 
              lockedByOther={lockedByOther}
              isMyLock={isMyLock}
              acquireLock={beginNodeEditing}
              releaseLock={exitEditMode}
              error={lockError}
            />
          </div>
        </div>
        {isMyLock ? (
          <form
            onSubmit={handleUpdateNode}
            className="space-y-4 border-t border-slate-200 pt-4"
          >
            <div>
              <label
                htmlFor="node-name"
                className="mb-1 block text-xs font-medium text-slate-700"
              >
                Nome nodo *
              </label>
              <input
                id="node-name"
                type="text"
                required
                value={nodeName}
                onChange={(event) => setNodeName(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
              />
            </div>
            <div>
              <label
                htmlFor="node-description"
                className="mb-1 block text-xs font-medium text-slate-700"
              >
                Descrizione
              </label>
              <textarea
                id="node-description"
                rows={3}
                value={nodeDescription}
                onChange={(event) => setNodeDescription(event.target.value)}
                className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => void exitEditMode()}
                disabled={isSavingNode}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={isSavingNode || !nodeName.trim()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSavingNode ? 'Salvataggio…' : 'Salva modifiche'}
              </button>
            </div>
          </form>
        ) : (
          currentNode?.description && (
            <p className="border-t border-slate-200 pt-2 text-xs text-slate-500">
              {currentNode.description}
            </p>
          )
        )}
      </Panel>

      {dynamicNodeFields.filter((field) => ['file', 'image'].includes(field.dataType.toLowerCase())).map((field) => <Panel key={field.fieldKey} className="space-y-3"><SectionHeader title={field.label ?? field.fieldKey} description={field.dataType.toLowerCase() === 'image' ? 'Immagini collegate al campo.' : 'Documenti collegati al campo.'} /><AttachmentList resourceType="node" resourceId={nodeId} fieldKey={field.fieldKey} kind={field.dataType.toLowerCase() as 'file' | 'image'} canDelete={isMyLock} /></Panel>)}

      <Panel className="space-y-4">
        <SectionHeader
          title={`Entità del nodo (${nodeEntities.length})`}
          description="Le entità vengono visualizzate in base ai metadata del loro tipo."
          actions={!readOnly ? <Link href={`/nodes/${nodeId}/entities/new`} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">+ Nuova entità</Link> : undefined}
        />
        {isEntitiesLoading ? (
          <p className="p-6 text-center text-xs text-slate-500">Caricamento entità…</p>
        ) : nodeEntities.length === 0 ? (
          <p className="p-6 text-center text-xs text-slate-500">Nessuna entità associata a questo nodo.</p>
        ) : (
          <NodeEntityGrid
            nodeId={nodeId}
            entities={nodeEntities}
            entityTypes={entityTypes}
            entityDefinitions={entityDefinitions}
          />
        )}
      </Panel>

      {/* Sotto-Nodi Figli (es. Sotto-reparti o Sotto-ordini) */}
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-700 font-mono">
            <span>🌿</span> Sotto-Nodi Gerarchici ({childNodes.length})
          </h2>
          {!readOnly && (
            <Link
              href={`/nodes/${nodeId}/new`}
              className="text-xs text-indigo-400 font-semibold hover:underline"
            >
              + Aggiungi Sotto-Nodo
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {childNodes.length === 0 ? (
            <div className="col-span-3 glass-panel p-6 text-center text-xs text-slate-500 rounded-2xl">
              Nessun sotto-nodo figlio presente.
            </div>
          ) : (
            childNodes.map((childNode) => {
              const cId = childNode.id;
              return (
                <div key={cId} className="glass-panel group rounded-xl border border-slate-200 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-1"><Link href={`/nodes/${cId}`} className="min-w-0 truncate text-xs font-semibold text-slate-700 group-hover:text-indigo-600">{childNode?.name || cId}</Link><NodeResourceMenu nodeId={cId} nodeName={childNode?.name || cId} /></div>
                    <Link href={`/nodes/${cId}`} className="shrink-0 text-slate-500 group-hover:text-indigo-400 font-mono text-xs">→</Link>
                  </div>
                  <Link href={`/nodes/${cId}`} className="block"><p className="mt-1 truncate text-[11px] text-slate-400">{childNode?.description || 'Nessuna descrizione.'}</p></Link>
                </div>
              );
            })
          )}
        </div>
      </div>
      {/* Tabella Virtualizzata Sottoalbero Entità */}
      <SubtreeEntitiesTableSection nodeId={nodeId} />
    </PageShell>
  );
}
