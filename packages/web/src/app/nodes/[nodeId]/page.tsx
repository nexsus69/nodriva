'use client';

import React, { useState, useTransition } from 'react';
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
  const { entityTypes } = useSemanticMetadata();

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSavingNode, startNodeUpdate] = useTransition();
  const [nodeName, setNodeName] = useState('');
  const [nodeDescription, setNodeDescription] = useState('');

  // --- LOCK STATE ---
  const { lockedByOther, isMyLock, acquireLock, releaseLock, error: lockError } = useLock({ resourceType: 'node', resourceId: nodeId });
  const readOnly = !isMyLock;

  // --- REACTIVE READS FROM APPCACHE ---
  const { data: cachedCurrentNode, isLoading: isLoadingNode } = useCacheNode(nodeId);
  const currentNode = cachedCurrentNode;
  
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
    <div className="space-y-6">
      {/* Breadcrumb / Navigazione Superiore */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
        <NodeBreadcrumb nodeId={nodeId} />

        <div className="flex items-center gap-2">
          {!readOnly && (
            <>
              <Link
                href={`/nodes/${nodeId}/new`}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center gap-1.5"
              >
                <span>➕</span> Sotto-Nodo
              </Link>
              <Link
                href={`/nodes/${nodeId}/entities/new`}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5"
              >
                <span>➕</span> Nuova Entità
              </Link>
            </>
          )}
        </div>
      </div>

      <NodeTree
        activeNodeId={nodeId}
        activeNodePath={currentNode?.path}
      />

      {/* Messaggi Feedback */}
      {displayedError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
          <span className="font-bold">Errore:</span> {displayedError}
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
          <span className="font-bold">Esito:</span> {successMsg}
        </div>
      )}

      {/* Testata Nodo Selezionato */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-xl text-indigo-400">
              📦
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                {isNodeLoading && (
                  <svg className="animate-spin h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {currentNode?.name || 'Caricamento...'}
              </h1>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Path: {currentNode?.pathLabel || currentNode?.path || '-'}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-mono text-[10px] uppercase border border-slate-700">
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
            className="space-y-4 border-t border-slate-800/60 pt-4"
          >
            <div>
              <label
                htmlFor="node-name"
                className="mb-1 block text-xs font-medium text-slate-300"
              >
                Nome nodo *
              </label>
              <input
                id="node-name"
                type="text"
                required
                value={nodeName}
                onChange={(event) => setNodeName(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="node-description"
                className="mb-1 block text-xs font-medium text-slate-300"
              >
                Descrizione
              </label>
              <textarea
                id="node-description"
                rows={3}
                value={nodeDescription}
                onChange={(event) => setNodeDescription(event.target.value)}
                className="w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => void exitEditMode()}
                disabled={isSavingNode}
                className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
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
            <p className="border-t border-slate-800/60 pt-2 text-xs text-slate-300">
              {currentNode.description}
            </p>
          )
        )}
      </div>

      {/* Sezione Cliente & Prodotti per Ordine */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card Profilo Cliente */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <span>👤</span> Dettaglio Cliente
            </h2>
            {customerEntity && (
              <Link
                href={`/nodes/${nodeId}/entities/${customerEntity.id}`}
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300"
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
                <p className="font-semibold text-slate-200">{activeCustomer.name}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-mono block">EMAIL</span>
                <p className="font-mono text-slate-300">{String(activeCustomer.payload?.email || '-')}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-mono block">TELEFONO</span>
                <p className="font-mono text-slate-300">{String(activeCustomer.payload?.phone || '-')}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-mono block">INDIRIZZO CONSEGNA</span>
                <p className="text-slate-300">{String(activeCustomer.payload?.address || '-')}</p>
              </div>
              <div className="pt-2 border-t border-slate-800/60 flex justify-end">
                <Link
                  href={`/nodes/${nodeId}/entities/${activeCustomer.id}`}
                  className="text-[11px] text-slate-400 hover:text-slate-200 font-mono"
                >
                  Dettaglio Completo →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Tabella Prodotti Ordine (Order Items) */}
        <div className="lg:col-span-2 glass-panel p-5 rounded-2xl border border-slate-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <span>🛒</span> Articoli dell&apos;Ordine ({orderItems.length})
              </h2>
              {!readOnly && (
                <button
                  onClick={() => setShowAddItemForm(!showAddItemForm)}
                  className="px-3 py-1 rounded-lg text-xs font-semibold bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 border border-purple-500/30 transition-all"
                >
                  {showAddItemForm ? 'Chiudi Form' : '➕ Aggiungi Prodotto'}
                </button>
              )}
            </div>

            {/* Form Veloce Aggiunta Prodotto */}
            {!readOnly && showAddItemForm && (
              <form onSubmit={handleAddOrderItem} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Nome Prodotto *</label>
                    <input
                      type="text"
                      required
                      placeholder="es. Generatore Inverter"
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Quantità *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={itemQty}
                      onChange={(e) => setItemQty(parseInt(e.target.value, 10))}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Prezzo Unitario (€) *</label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      min={0}
                      value={itemPrice}
                      onChange={(e) => setItemPrice(parseFloat(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 font-mono"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="submit"
                    disabled={isAddingItem || !itemName}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/20"
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
                    <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 font-mono uppercase">
                      <th className="py-2.5 px-4">Prodotto</th>
                      <th className="py-2.5 px-4 text-center">Qtà</th>
                      <th className="py-2.5 px-4 text-right">Prezzo Unitario</th>
                      <th className="py-2.5 px-4 text-right">Totale Row</th>
                      <th className="py-2.5 px-4 text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs">
                    {orderItems.map((item) => {
                      const qty = Number(item.payload?.quantity ?? 1);
                      const price = Number(item.payload?.unit_price ?? 0);
                      const rowTotal = qty * price;
                      return (
                        <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-200">
                            {String(item.payload?.product_name || item.name)}
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-slate-300">{qty}</td>
                          <td className="py-3 px-4 text-right font-mono text-slate-300">€{price.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                            €{rowTotal.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Link
                                href={`/nodes/${nodeId}/entities/${item.id}`}
                                className="text-rose-400 hover:text-rose-300 text-xs font-semibold"
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
          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">TOTALE COMPLESSIVO ORDINE</span>
            <span className="text-lg font-bold font-mono text-emerald-400">€{orderTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Sotto-Nodi Figli (es. Sotto-reparti o Sotto-ordini) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-200 uppercase font-mono tracking-wider flex items-center gap-2">
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
                  className="glass-panel p-4 rounded-xl border border-slate-800 hover:border-indigo-500/40 transition-all block group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-slate-200 group-hover:text-indigo-300">
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
