'use client';

import React, { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  PlacementPolicyListItemDto,
  PolicyMode,
  CreatePlacementPolicyUiCommand,
  UpdatePlacementPolicyUiCommand,
  ApiErrorResponse,
} from '@dashboard/core';
import {
  listPlacementPoliciesAction,
  createPlacementPolicyAction,
  updatePlacementPolicyAction,
  deletePlacementPolicyAction,
} from '../../../actions/systemActions';

export default function PlacementPoliciesPage() {
  const [policies, setPolicies] = useState<PlacementPolicyListItemDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiErrorResponse | null>(null);

  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [editingPolicy, setEditingPolicy] = useState<PlacementPolicyListItemDto | null>(null);

  const [policyKey, setPolicyKey] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [policyMode, setPolicyMode] = useState<PolicyMode>('allow_all');
  const [formError, setFormError] = useState<ApiErrorResponse | null>(null);

  const [isPending, startTransition] = useTransition();

  const loadData = async () => {
    setLoading(true);
    setError(null);
    const res = await listPlacementPoliciesAction();
    if (res.success && res.data) setPolicies(res.data);
    else if (res.error) setError(res.error);
    setLoading(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(loadData, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleOpenCreateModal = () => {
    setEditingPolicy(null);
    setPolicyKey('');
    setName('');
    setDescription('');
    setPolicyMode('allow_all');
    setFormError(null);
    setShowCreateModal(true);
  };

  const handleOpenEditModal = (p: PlacementPolicyListItemDto) => {
    setEditingPolicy(p);
    setPolicyKey(p.policyKey);
    setName(p.name);
    setDescription(p.description);
    setPolicyMode(p.policyMode);
    setFormError(null);
    setShowCreateModal(true);
  };

  const handleSubmitPolicy = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    startTransition(async () => {
      if (editingPolicy) {
        const cmd: UpdatePlacementPolicyUiCommand = {
          policyKey: editingPolicy.policyKey,
          name,
          description,
          policyMode,
          expectedRowVersion: editingPolicy.rowVersion,
        };
        const res = await updatePlacementPolicyAction(cmd);
        if (res.success) {
          setShowCreateModal(false);
          await loadData();
        } else if (res.error) {
          setFormError(res.error);
        }
      } else {
        const cmd: CreatePlacementPolicyUiCommand = {
          policyKey,
          name,
          description,
          policyMode,
        };
        const res = await createPlacementPolicyAction(cmd);
        if (res.success) {
          setShowCreateModal(false);
          await loadData();
        } else if (res.error) {
          setFormError(res.error);
        }
      }
    });
  };

  const handleDeletePolicy = (p: PlacementPolicyListItemDto) => {
    if (!confirm(`Sei sicuro di voler eliminare la Placement Policy '${p.name}'?`)) return;
    setError(null);

    startTransition(async () => {
      const res = await deletePlacementPolicyAction({
        policyKey: p.policyKey,
        expectedRowVersion: 1,
      });
      if (res.success) {
        await loadData();
      } else if (res.error) {
        setError(res.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <span>🗺️</span> Placement Policies (Politiche di Posizionamento)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gestisci le strategie fisiche di allocazione dei dati a DB per i tipi di entità e le partizioni fisiche.
          </p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/25 transition-all flex items-center gap-2 self-start md:self-auto"
        >
          <span>➕</span> Nuova Placement Policy
        </button>
      </div>

      {/* Errore Generale */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
          <span className="font-bold">Errore [{error.code}]:</span> {error.message}
        </div>
      )}

      {/* Grid Policies */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-2 glass-panel p-8 text-center text-xs text-slate-400">
            Caricamento placement policies in corso...
          </div>
        ) : policies.length === 0 ? (
          <div className="col-span-2 glass-panel p-12 text-center space-y-3">
            <span className="text-3xl block">🗺️</span>
            <p className="text-sm font-semibold text-slate-300">Nessuna Placement Policy trovata</p>
            <p className="text-xs text-slate-500">Crea una nuova policy per regolare l&apos;allocazione delle entità.</p>
          </div>
        ) : (
          policies.map((p) => (
            <div
              key={p.id}
              className="glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-all"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-mono text-xs font-bold text-purple-300">
                    {p.policyKey}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] uppercase border border-slate-700">
                    {p.policyMode}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-100">{p.name}</h3>
                <p className="text-xs text-slate-400 mt-1">{p.description || 'Nessuna descrizione specificata.'}</p>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">
                  Regole attive: <strong className="text-slate-200">{p.ruleCount}</strong>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEditModal(p)}
                    disabled={isPending}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                  >
                    ✏️ Modifica
                  </button>
                  <button
                    onClick={() => handleDeletePolicy(p)}
                    disabled={isPending}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition-colors"
                  >
                    🗑️
                  </button>
                  <Link
                    href={`/admin/system/placement-policies/${p.policyKey}`}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 transition-colors"
                  >
                    ⚙️ Regole →
                  </Link>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modale Creazione / Modifica Policy */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>{editingPolicy ? '✏️' : '➕'}</span> {editingPolicy ? 'Modifica Placement Policy' : 'Nuova Placement Policy'}
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                {formError.message}
              </div>
            )}

            <form onSubmit={handleSubmitPolicy} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Chiave Policy (Snake Case) *
                </label>
                <input
                  required
                  disabled={Boolean(editingPolicy)}
                  type="text"
                  placeholder="es. default_single_table"
                  value={policyKey}
                  onChange={(e) => setPolicyKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-purple-500 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Nome Policy *</label>
                <input
                  required
                  type="text"
                  placeholder="es. Single Table Storage"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Descrizione</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Modalità Allocazione *</label>
                <select
                  value={policyMode}
                  onChange={(e) => setPolicyMode(e.target.value as PolicyMode)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-purple-500 font-mono"
                >
                  <option value="allow_all">allow_all (Consenti Tutti i Nodi)</option>
                  <option value="deny_all">deny_all (Blocca Tutti i Nodi)</option>
                  <option value="node_type_whitelist">node_type_whitelist (Whitelist per Tipo Nodo)</option>
                  <option value="node_subtree_whitelist">node_subtree_whitelist (Whitelist per Sottoalbero)</option>
                  <option value="custom_rule">custom_rule (Regola Custom)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={isPending || !policyKey || !name}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/20 disabled:opacity-50"
                >
                  {isPending ? 'Salvataggio...' : editingPolicy ? 'Salva Modifiche' : 'Crea Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
