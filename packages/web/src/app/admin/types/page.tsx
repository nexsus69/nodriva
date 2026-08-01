'use client';

import React, { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  TypeKind,
  TypeListItemDto,
  CreateTypeUiCommand,
  ApiErrorResponse,
} from '@dashboard/core';
import { listTypesAction, createTypeAction } from '../../actions/typeActions';

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
    const res = await listTypesAction(selectedKind);
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
      const res = await createTypeAction(cmd);
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
        <div className="p-4 bg-red-950/40 border border-red-500/30 rounded-xl text-red-300 text-sm flex items-center justify-between">
          <span>⚠️ {error.message}</span>
          <button
            onClick={() => loadTypes(kind)}
            className="px-3 py-1 bg-red-900/40 hover:bg-red-800/40 text-red-200 rounded text-xs"
          >
            Ricarica
          </button>
        </div>
      )}

      {/* Tabella Tipi */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800/80 shadow-2xl">
        {loading ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm">Caricamento tipi in corso...</p>
          </div>
        ) : types.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <p className="text-lg font-medium text-slate-300">Nessun tipo configurato per {kind}</p>
            <p className="text-sm">Crea il tuo primo tipo per iniziare ad amministrare i dati.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-900/80 text-slate-400 font-medium">
                  <th className="py-3.5 px-5">Nome / Tipo</th>
                  <th className="py-3.5 px-5">Type Key</th>
                  {kind === 'entity' && <th className="py-3.5 px-5">Storage Table</th>}
                  <th className="py-3.5 px-5">Schema Ver.</th>
                  <th className="py-3.5 px-5">Row Ver.</th>
                  <th className="py-3.5 px-5">Campi</th>
                  <th className="py-3.5 px-5">Stato</th>
                  <th className="py-3.5 px-5 text-right">Azione</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {types.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="py-4 px-5">
                      <div className="font-semibold text-slate-100 flex items-center gap-2">
                        {t.name}
                        {t.isSystem && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md">
                            SYSTEM
                          </span>
                        )}
                      </div>
                      {t.description && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{t.description}</p>
                      )}
                    </td>
                    <td className="py-4 px-5 font-mono text-xs text-indigo-300">{t.typeKey}</td>
                    {kind === 'entity' && (
                      <td className="py-4 px-5 font-mono text-xs text-slate-400">{t.storageTable ?? 'N/A'}</td>
                    )}
                    <td className="py-4 px-5 text-slate-300 font-mono">v{t.currentSchemaVersion}</td>
                    <td className="py-4 px-5 text-slate-400 font-mono">r{t.rowVersion}</td>
                    <td className="py-4 px-5">
                      <span className="px-2.5 py-1 bg-slate-800 text-slate-300 text-xs font-medium rounded-full">
                        {t.fieldCount} campi
                      </span>
                    </td>
                    <td className="py-4 px-5">
                      {t.isActive ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Attivo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-rose-400 font-medium">
                          <span className="w-2 h-2 rounded-full bg-rose-500"></span> Disabilitato
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-5 text-right">
                      <Link
                        href={`/admin/types/${kind}/${t.typeKey}`}
                        className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white rounded-lg transition-all"
                      >
                        Dettaglio & Campi →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal di Creazione Tipo */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel bg-slate-900 border border-slate-700/80 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
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
          </div>
        </div>
      )}
    </div>
  );
}
