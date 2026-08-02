'use client';

import React, { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSemanticNodeList } from '../../hooks/useSemanticNodeList';
import { useSemanticEntityCollection } from '../../hooks/useSemanticEntityCollection';
import { useSemanticMetadata } from '../../hooks/useSemanticMetadata';
import { AppCache } from '../../cache/GlobalCacheClient';
import { useCacheEntity } from '../../hooks/useCacheEntity';
import { useCacheNode } from '../../hooks/useCacheNode';
import { LockBadge } from '../../components/LockBadge';
import { NodeTree } from '../../components/navigation/NodeTree';
import { NodeBreadcrumb } from '../../components/navigation/NodeBreadcrumb';
import { useLock } from '../../hooks/useLock';
import { SubtreeEntitiesTableSection } from './_components/SubtreeEntitiesTableSection';

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
  const [dynamicNodeFields, setDynamicNodeFields] = useState<DynamicNodeField[]>([]);
  const [dynamicNodePayload, setDynamicNodePayload] = useState<Record<string, unknown>>({});

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
  
  // Combine readModel pending fetch with cache pending fetch
  const isNodeLoading = isLoadingNode || !currentNode;

  // Entità collegate al nodo corrente
  // Distinzione tra Customer Info ed Order Items per la vista Ordine
  const customerEntity = nodeEntities.find(
    (e) => e.entityTypeId === entityTypes['customer-info']?.id || e.entityTypeId === entityTypes['customer-info']?.typeKey
  );
  const orderItems = nodeEntities.filter(
    (e) => e.entityTypeId === entityTypes['order-item']?.id || e.entityTypeId === entityTypes['order-item']?.typeKey
  );
  // --- REACTIVE READS FROM APPCACHE ---
  const { data: cachedCustomer } = useCacheEntity(
    customerEntity?.entityTypeId || 'customer-info', 
    customerEntity?.id || null
  );
  const activeCustomer = cachedCustomer || customerEntity;

  // Form Aggiunta Veloce Prodotto (Order Item)
  const [showAddItemForm, setShowAddItemForm] = useState(false);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemQty, setItemQty] = useState(1);
  const [itemPrice, setItemPrice] = useState(0.0);

  const beginNodeEditing = async (): Promise<boolean> => {
    if (!currentNode) return false;
    setErrorMsg(null);
    setSuccessMsg(null);
    setNodeName(currentNode.name);
    setNodeDescription(currentNode.description || '');
    return await acquireLock();
  };

  const exitEditMode = async () => {
    setShowAddItemForm(false);
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

  const handleAddOrderItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsAddingItem(true);
    try {
      await AppCache.createEntity({
        parentNodeId: nodeId,
        entityTypeKey: 'order-item',
        name: itemName,
        description: `Product ${itemName}`,
        payload: {
          product_name: itemName,
          quantity: itemQty,
          unit_price: itemPrice,
        },
      });
      setSuccessMsg('Articolo aggiunto all\'ordine. Ricarica la pagina per vederlo se non appare.');
      setShowAddItemForm(false);
      setItemName('');
      setItemQty(1);
      setItemPrice(0.0);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? `Errore aggiunta articolo: ${err.message}` : 'Errore aggiunta articolo.'
      );
    } finally {
      setIsAddingItem(false);
    }
  };

  const orderTotal = orderItems.reduce((acc, item) => {
    const qty = Number(item.payload?.quantity ?? 0);
    const price = Number(item.payload?.unit_price ?? 0);
    return acc + qty * price;
  }, 0);

  return (
    <div className="workspace-page space-y-6 pb-8">
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
        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-500">Contesto</p><h2 className="mt-1 text-sm font-semibold text-slate-800">Riepilogo nodo</h2></div>
            <span className={`h-2.5 w-2.5 rounded-full ${isMyLock ? 'bg-emerald-500' : lockedByOther ? 'bg-amber-500' : 'bg-slate-300'}`} title={isMyLock ? 'Modifica attiva' : lockedByOther ? 'Bloccato da altro utente' : 'Sola lettura'} />
          </div>
          <dl className="mt-4 space-y-4 text-xs">
            <div><dt className="text-[10px] uppercase tracking-wider text-slate-400">Nodo corrente</dt><dd className="mt-1 truncate font-semibold text-slate-800">{currentNode?.name || 'Caricamento…'}</dd></div>
            <div className="grid grid-cols-2 gap-3"><div><dt className="text-[10px] uppercase tracking-wider text-slate-400">Sotto-nodi</dt><dd className="mt-1 text-lg font-semibold text-slate-800">{childNodes.length}</dd></div><div><dt className="text-[10px] uppercase tracking-wider text-slate-400">Entità</dt><dd className="mt-1 text-lg font-semibold text-slate-800">{nodeEntities.length}</dd></div></div>
            <div><dt className="text-[10px] uppercase tracking-wider text-slate-400">Totale ordine</dt><dd className="mt-1 text-lg font-semibold text-emerald-600">€{orderTotal.toFixed(2)}</dd></div>
            <div className="border-t border-slate-100 pt-3"><dt className="text-[10px] uppercase tracking-wider text-slate-400">Modalità</dt><dd className="mt-1 font-medium text-slate-600">{isMyLock ? 'Modifica autorizzata' : lockedByOther ? 'Bloccato temporaneamente' : 'Sola lettura'}</dd></div>
          </dl>
        </aside>
      </div>

      {/* Messaggi Feedback */}
      {displayedError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">
          <span className="font-bold">Errore:</span> {displayedError}
        </div>
      )}
      {successMsg && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-700">
          <span className="font-bold">Esito:</span> {successMsg}
        </div>
      )}

      {/* Testata Nodo Selezionato */}
      <section className="glass-panel space-y-2 rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between">
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
                {currentNode?.name || 'Caricamento...'}
              </h1>
              <p className="mt-0.5 text-xs font-mono text-slate-400">
                Path: {currentNode?.pathLabel || currentNode?.path || '-'}
              </p>
            </div>
            {dynamicNodeFields.length > 0 && (
              <div className="space-y-3 border-t border-slate-200 pt-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Campi dinamici</h3>
                {dynamicNodeFields.map((field) => field.dataType.toLowerCase() === 'boolean' ? (
                  <label key={field.fieldKey} className="flex items-center gap-2 text-xs text-slate-700">
                    <input type="checkbox" checked={Boolean(dynamicNodePayload[field.fieldKey])}
                      onChange={(event) => setDynamicNodePayload({ ...dynamicNodePayload, [field.fieldKey]: event.target.checked })} />
                    {field.fieldKey} {field.isRequired ? '*' : ''}
                  </label>
                ) : (
                  <div key={field.fieldKey}>
                    <label className="mb-1 block text-xs font-medium text-slate-600">{field.fieldKey} {field.isRequired ? '*' : ''}</label>
                    <input value={String(dynamicNodePayload[field.fieldKey] ?? '')}
                      onChange={(event) => setDynamicNodePayload({ ...dynamicNodePayload, [field.fieldKey]: event.target.value })}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900" />
                  </div>
                ))}
              </div>
            )}
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
      </section>

      {/* Sezione Cliente & Prodotti per Ordine */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card Profilo Cliente */}
        <div className="glass-panel space-y-4 rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <span>👤</span> Dettaglio Cliente
            </h2>
            {customerEntity && (
              <Link
                href={`/nodes/${nodeId}/entities/${customerEntity.id}`}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
              >
                {readOnly ? 'Visualizza →' : 'Apri / modifica →'}
              </Link>
            )}
          </div>

          {!activeCustomer ? (
            <div className="p-6 text-center space-y-2 flex flex-col items-center justify-center">
              {isEntitiesLoading ? (
                <>
                  <svg className="animate-spin h-6 w-6 text-indigo-500 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-xs text-slate-400">Caricamento profilo cliente...</p>
                </>
              ) : (
                <>
                  <p className="text-xs text-slate-400">Nessun profilo cliente associato a questo nodo.</p>
                  {!readOnly && (
                    <Link
                      href={`/nodes/${nodeId}/entities/new`}
                      className="text-xs text-indigo-400 font-semibold hover:underline block"
                    >
                      + Crea Cliente
                    </Link>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 font-mono block">NOME CLIENTE</span>
                <p className="font-semibold text-slate-800">{activeCustomer.name}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-mono block">EMAIL</span>
                <p className="font-mono text-slate-600">{String(activeCustomer.payload?.email || '-')}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-mono block">TELEFONO</span>
                <p className="font-mono text-slate-600">{String(activeCustomer.payload?.phone || '-')}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-mono block">INDIRIZZO CONSEGNA</span>
                <p className="text-slate-600">{String(activeCustomer.payload?.address || '-')}</p>
              </div>
              <div className="flex justify-end border-t border-slate-200 pt-2">
                <Link
                  href={`/nodes/${nodeId}/entities/${activeCustomer.id}`}
                  className="text-[11px] font-mono text-slate-500 hover:text-slate-800"
                >
                  Dettaglio Completo →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Tabella Prodotti Ordine (Order Items) */}
        <div className="glass-panel flex flex-col justify-between space-y-4 rounded-2xl border border-slate-200 p-5 shadow-sm lg:col-span-2">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <span>🛒</span> Articoli dell&apos;Ordine ({orderItems.length})
              </h2>
              {!readOnly && (
                <button
                  onClick={() => setShowAddItemForm(!showAddItemForm)}
                  className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 transition-all hover:bg-violet-100"
                >
                  {showAddItemForm ? 'Chiudi Form' : '➕ Aggiungi Prodotto'}
                </button>
              )}
            </div>

            {/* Form Veloce Aggiunta Prodotto */}
            {!readOnly && showAddItemForm && (
              <form onSubmit={handleAddOrderItem} className="space-y-3 rounded-xl border border-violet-100 bg-violet-50/60 p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-600">Nome Prodotto *</label>
                    <input
                      type="text"
                      required
                      placeholder="es. Generatore Inverter"
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-600">Quantità *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={itemQty}
                      onChange={(e) => setItemQty(parseInt(e.target.value, 10))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-600">Prezzo Unitario (€) *</label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      min={0}
                      value={itemPrice}
                      onChange={(e) => setItemPrice(parseFloat(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="submit"
                    disabled={isAddingItem || !itemName}
                    className="rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white shadow-md shadow-violet-600/20 hover:bg-violet-500"
                  >
                    Aggiungi all&apos;Ordine
                  </button>
                </div>
              </form>
            )}

            {/* Lista Articoli */}
            <div className="overflow-x-auto">
              {orderItems.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Nessun prodotto presente in questo ordine.
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase text-slate-400 font-mono">
                      <th className="py-2.5 px-4">Prodotto</th>
                      <th className="py-2.5 px-4 text-center">Qtà</th>
                      <th className="py-2.5 px-4 text-right">Prezzo Unitario</th>
                      <th className="py-2.5 px-4 text-right">Totale Row</th>
                      <th className="py-2.5 px-4 text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {orderItems.map((item) => {
                      const qty = Number(item.payload?.quantity ?? 1);
                      const price = Number(item.payload?.unit_price ?? 0);
                      const rowTotal = qty * price;
                      return (
                        <tr key={item.id} className="transition-colors hover:bg-slate-50">
                          <td className="px-4 py-3 font-semibold text-slate-700">
                            {String(item.payload?.product_name || item.name)}
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-slate-500">{qty}</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-500">€{price.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">
                            €{rowTotal.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Link
                                href={`/nodes/${nodeId}/entities/${item.id}`}
                                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                              >
                                Apri
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Totale Ordine */}
          <div className="flex items-center justify-between border-t border-slate-200 pt-4">
            <span className="text-xs font-mono text-slate-400">TOTALE COMPLESSIVO ORDINE</span>
            <span className="text-lg font-bold font-mono text-emerald-600">€{orderTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Sotto-Nodi Figli (es. Sotto-reparti o Sotto-ordini) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
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
                <Link
                  key={cId}
                  href={`/nodes/${cId}`}
                  className="glass-panel group block rounded-xl border border-slate-200 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 group-hover:text-indigo-600">
                      {childNode?.name || cId}
                    </span>
                    <span className="text-slate-500 group-hover:text-indigo-400 font-mono text-xs">→</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 truncate">
                    {childNode?.description || 'Nessuna descrizione.'}
                  </p>
                </Link>
              );
            })
          )}
        </div>
      </div>
      {/* Tabella Virtualizzata Sottoalbero Entità */}
      <SubtreeEntitiesTableSection nodeId={nodeId} />
    </div>
  );
}
