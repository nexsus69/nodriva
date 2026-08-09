'use client';

import React, { useEffect, useState, useTransition } from 'react';
import {
  TypeKind,
  TypeListItemDto,
  CreateTypeUiCommand,
  ApiErrorResponse,
} from '@dashboard/core';
import { AppCache } from '../../cache/GlobalCacheClient';
import { TypeListTable } from './_components/TypeListTable';
import { AdminModalShell } from '../_components/AdminModalShell';

export default function AdminTypesListPage() {
  const [kind, setKind] = useState<TypeKind>('node');
  const [types, setTypes] = useState<TypeListItemDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiErrorResponse | null>(null);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [isPending, startTransition] = useTransition();

  // State per form di creazione
  const [newTypeKey, setNewTypeKey] = useState('');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newStorageTable, setNewStorageTable] = useState('');
  const [formError, setFormError] = useState<ApiErrorResponse | null>(null);

  const loadTypes = async (selectedKind: TypeKind) => {
    setLoading(true);
    setError(null);
    const res = await AppCache.admin.listTypes(selectedKind);
    if (res.success && res.data) {
      setTypes(res.data);
    } else if (res.error) {
      setError(res.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => loadTypes(kind), 0);
    return () => window.clearTimeout(timer);
  }, [kind]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cmd: CreateTypeUiCommand = {
      kind,
      typeKey: newTypeKey.trim(),
      name: newName.trim(),
      description: newDescription.trim() || undefined,
      storageTable: kind === 'entity' ? (newStorageTable.trim() || undefined) : undefined,
    };

    startTransition(async () => {
      const res = await AppCache.admin.createType(cmd);
      if (res.success && res.data) {
        setShowCreateModal(false);
        setNewTypeKey('');
        setNewName('');
        setNewDescription('');
        setNewStorageTable('');
        // Ricarica la lista tipi
        loadTypes(kind);
      } else if (res.error) {
        setFormError(res.error);
      }
    });
  };

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>⚙️</span> Admin Dashboard — Tipi Modello
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Gestione amministrativa dei nodi e delle entità dinamiche della piattaforma.
          </p>
        </div>

        <button
          onClick={() => {
            setFormError(null);
            setShowCreateModal(true);
          }}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg shadow-lg hover:shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
        >
          <span>+</span> Crea Nuovo {kind === 'node' ? 'Nodo' : 'Entità'}
        </button>
      </div>

      {/* Selector Kind Tab */}
      <div className="flex items-center gap-2 bg-slate-900/60 p-1.5 rounded-xl border border-slate-800 w-fit">
        <button
          onClick={() => setKind('node')}
          className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
            kind === 'node'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          🌲 Node Types (Gerarchici)
        </button>
        <button
          onClick={() => setKind('entity')}
          className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
            kind === 'entity'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          📦 Entity Types (Dati Dinamici)
        </button>
      </div>

      {/* Errore principale */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center justify-between gap-4">
          <span><span className="font-bold">Errore [{error.code}]:</span> {error.message}</span>
          {error.code !== 'ACCESS_FORBIDDEN' && (
            <button
              onClick={() => loadTypes(kind)}
              className="shrink-0 px-3 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs hover:bg-rose-500/20"
            >
              Ricarica
            </button>
          )}
        </div>
      )}

      {/* Tabella Tipi */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800/80 shadow-2xl">
        <TypeListTable kind={kind} types={types} loading={loading} />
      </div>

      {/* Modal di Creazione Tipo */}
      {showCreateModal && (
        <AdminModalShell className="max-w-lg bg-slate-900 border-slate-700/80 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xl font-bold text-white">Crea Nuovo {kind === 'node' ? 'Nodo' : 'Entità'}</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-lg text-red-300 text-xs">
                ⚠️ {formError.message}
                {formError.details && (
                  <ul className="list-disc ml-4 mt-1">
                    {formError.details.map((d, i) => (
                      <li key={i}>{d.field ? `${d.field}: ` : ''}{d.message}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Type Key *
                </label>
                <input
                  type="text"
                  required
                  placeholder="es. customer_info"
                  value={newTypeKey}
                  onChange={(e) => setNewTypeKey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">Min minuscole, numeri e underscore. Immutabile dopo la creazione.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Nome *
                </label>
                <input
                  type="text"
                  required
                  placeholder="es. Info Cliente"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Descrizione
                </label>
                <textarea
                  rows={2}
                  placeholder="Descrizione opzionale dello scopo del tipo..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {kind === 'entity' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Storage Table (Fisica) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="es. entity_customer_info"
                    value={newStorageTable}
                    onChange={(e) => setNewStorageTable(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Verrà creata automaticamente nel DB via DDL.</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg shadow-md disabled:opacity-50"
                >
                  {isPending ? 'Creazione...' : 'Crea Tipo'}
                </button>
              </div>
            </form>
        </AdminModalShell>
      )}
    </div>
  );
}
