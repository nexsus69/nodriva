'use client';

import React, { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  PlacementPolicyDetailDto,
  CreatePlacementRuleUiCommand,
  UpdatePlacementPolicyUiCommand,
  PolicyMode,
  RuleType,
  ApiErrorResponse,
} from '@dashboard/core';
import { AppCache } from '../../../../cache/GlobalCacheClient';
import { ConfirmModal } from '../../../../components/ui/ConfirmModal';

export default function PlacementPolicyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const policyKey = params.policyKey as string;

  const [policy, setPolicy] = useState<PlacementPolicyDetailDto | null>(null);
  const [nodes, setNodes] = useState<{ id: string; name: string }[]>([]);
  const [nodeTypes, setNodeTypes] = useState<{ id: string; name: string }[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiErrorResponse | null>(null);

  const [showEditPolicyModal, setShowEditPolicyModal] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editPolicyMode, setEditPolicyMode] = useState<PolicyMode>('allow_all');

  const [showAddRuleModal, setShowAddRuleModal] = useState<boolean>(false);
  const [ruleType, setRuleType] = useState<RuleType>('allow_node_type');
  const [targetNodeId, setTargetNodeId] = useState<string>('');
  const [targetNodeTypeId, setTargetNodeTypeId] = useState<string>('');
  const [comparator, setComparator] = useState<string>('EQUALS');
  const [valueText, setValueText] = useState<string>('');
  const [formError, setFormError] = useState<ApiErrorResponse | null>(null);

  const [isPending, startTransition] = useTransition();

  const loadData = async () => {
    setLoading(true);
    setError(null);
    const [resPolicy, rootNodes, resNodeTypes] = await Promise.all([
      AppCache.admin.getPlacementPolicyByKey(policyKey),
      AppCache.admin.listChildren(null),
      AppCache.admin.listTypes('node'),
    ]);

    if (resPolicy.success && resPolicy.data) {
      setPolicy(resPolicy.data);
      setEditName(resPolicy.data.name);
      setEditDescription(resPolicy.data.description);
      setEditPolicyMode(resPolicy.data.policyMode);
    } else if (resPolicy.error) {
      setError(resPolicy.error);
    }

    if (rootNodes) setNodes(rootNodes.map((n) => ({ id: n.id, name: n.name })));
    if (resNodeTypes.success && resNodeTypes.data) setNodeTypes(resNodeTypes.data.map((nt) => ({ id: nt.id, name: nt.name })));

    setLoading(false);
  };

  useEffect(() => {
    if (!policyKey) return;
    const timer = window.setTimeout(() => {
      Promise.all([
        AppCache.admin.getPlacementPolicyByKey(policyKey),
        AppCache.admin.listChildren(null),
        AppCache.admin.listTypes('node'),
      ]).then(([resPolicy, rootNodes, resNodeTypes]) => {
        if (resPolicy.success && resPolicy.data) {
          setPolicy(resPolicy.data);
          setEditName(resPolicy.data.name);
          setEditDescription(resPolicy.data.description);
          setEditPolicyMode(resPolicy.data.policyMode);
        } else if (resPolicy.error) {
          setError(resPolicy.error);
        }
        if (rootNodes) setNodes(rootNodes.map((node) => ({ id: node.id, name: node.name })));
        if (resNodeTypes.success && resNodeTypes.data) {
          setNodeTypes(resNodeTypes.data.map((type) => ({ id: type.id, name: type.name })));
        }
        setLoading(false);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [policyKey]);

  const handleUpdatePolicy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!policy) return;
    setFormError(null);

    const cmd: UpdatePlacementPolicyUiCommand = {
      policyKey: policy.policyKey,
      name: editName,
      description: editDescription,
      policyMode: editPolicyMode,
      expectedRowVersion: policy.rowVersion,
    };

    startTransition(async () => {
      const res = await AppCache.admin.updatePlacementPolicy(cmd);
      if (res.success) {
        setShowEditPolicyModal(false);
        await loadData();
      } else if (res.error) {
        setFormError(res.error);
      }
    });
  };

  const handleDeletePolicy = () => {
    if (!policy) return;
    setShowDeleteConfirm(true);
  };

  const confirmDeletePolicy = () => {
    if (!policy) return;
    setShowDeleteConfirm(false);

    startTransition(async () => {
      const res = await AppCache.admin.deletePlacementPolicy({
        policyKey: policy.policyKey,
        expectedRowVersion: policy.rowVersion,
      });
      if (res.success) {
        router.push('/admin/system/placement-policies');
      } else if (res.error) {
        setError(res.error);
      }
    });
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cmd: CreatePlacementRuleUiCommand = {
      policyKey,
      ruleType,
      targetNodeId: targetNodeId || undefined,
      targetNodeTypeId: targetNodeTypeId || undefined,
      comparator: comparator || undefined,
      valueText: valueText || undefined,
    };

    startTransition(async () => {
      const res = await AppCache.admin.createPlacementRule(cmd);
      if (res.success) {
        setShowAddRuleModal(false);
        setRuleType('allow_node_type');
        setTargetNodeId('');
        setTargetNodeTypeId('');
        setComparator('EQUALS');
        setValueText('');
        await loadData();
      } else if (res.error) {
        setFormError(res.error);
      }
    });
  };

  const handleDeleteRule = (ruleId: string) => {
    startTransition(async () => {
      const res = await AppCache.admin.deletePlacementRule({ ruleId });
      if (res.success) {
        await loadData();
      } else if (res.error) {
        setError(res.error);
      }
    });
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-slate-400">
        Caricamento dettaglio policy in corso...
      </div>
    );
  }

  if (error || !policy) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/system/placement-policies"
          className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1 font-mono"
        >
          ← Torna alle Placement Policies
        </Link>
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
          <span className="font-bold">Errore:</span> {error?.message || 'Placement policy non trovata.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ConfirmModal
        open={showDeleteConfirm}
        title="Elimina placement policy"
        message={`Sei sicuro di voler eliminare la Placement Policy '${policy.name}'?`}
        confirmLabel="Elimina"
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDeletePolicy}
        busy={isPending}
      />
      {/* Breadcrumb */}
      <Link
        href="/admin/system/placement-policies"
        className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1 font-mono"
      >
        ← Torna all&apos;Elenco Policy
      </Link>

      {/* Scheda Header */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-bold text-purple-300">
              {policy.policyKey}
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] uppercase border border-slate-700">
              {policy.policyMode}
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-100">{policy.name}</h1>
          <p className="text-xs text-slate-400 mt-1">{policy.description || 'Nessuna descrizione.'}</p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => setShowEditPolicyModal(true)}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center gap-1.5"
          >
            <span>✏️</span> Modifica Policy
          </button>
          <button
            onClick={handleDeletePolicy}
            disabled={isPending}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition-all flex items-center gap-1.5"
          >
            <span>🗑️</span> Elimina
          </button>
          <button
            onClick={() => setShowAddRuleModal(true)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/25 transition-all flex items-center gap-2"
          >
            <span>➕</span> Aggiungi Regola
          </button>
        </div>
      </div>

      {/* Lista Regole */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-200 uppercase font-mono tracking-wider flex items-center gap-2">
          <span>📋</span> Regole di Posizionamento Collegate
        </h2>

        <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
          {policy.rules.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <span className="text-3xl block">🧩</span>
              <p className="text-sm font-semibold text-slate-300">Nessuna regola definita per questa policy</p>
              <p className="text-xs text-slate-500">Le entità senza regola usano la configurazione di default.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-900/60 text-[11px] font-semibold text-slate-400 uppercase font-mono tracking-wider">
                  <th className="py-3 px-6">Tipo Regola</th>
                  <th className="py-3 px-6">Nodo Target</th>
                  <th className="py-3 px-6">Tipo Nodo Target</th>
                  <th className="py-3 px-6">Comparatore</th>
                  <th className="py-3 px-6">Valore Testo</th>
                  <th className="py-3 px-6 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {policy.rules.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-4 px-6 font-mono font-bold text-purple-300">
                      {r.ruleType}
                    </td>
                    <td className="py-4 px-6 font-medium text-slate-200">
                      {r.targetNodeName || <span className="text-slate-500 font-mono text-[10px]">-</span>}
                    </td>
                    <td className="py-4 px-6 font-medium text-slate-200">
                      {r.targetNodeTypeName || <span className="text-slate-500 font-mono text-[10px]">-</span>}
                    </td>
                    <td className="py-4 px-6 font-mono text-[10px] text-slate-400">
                      {r.comparator || '-'}
                    </td>
                    <td className="py-4 px-6 font-mono text-slate-200 max-w-xs truncate">
                      {r.valueText || '-'}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => handleDeleteRule(r.id)}
                        disabled={isPending}
                        className="px-3 py-1 rounded-lg text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition-colors"
                      >
                        Elimina
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modale Modifica Policy */}
      {showEditPolicyModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>✏️</span> Modifica Placement Policy
              </h3>
              <button
                onClick={() => setShowEditPolicyModal(false)}
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

            <form onSubmit={handleUpdatePolicy} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Chiave Policy</label>
                <input
                  disabled
                  value={policy.policyKey}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Nome Policy *</label>
                <input
                  required
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Descrizione</label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Modalità Allocazione *</label>
                <select
                  value={editPolicyMode}
                  onChange={(e) => setEditPolicyMode(e.target.value as PolicyMode)}
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
                  onClick={() => setShowEditPolicyModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={isPending || !editName}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/20 disabled:opacity-50"
                >
                  {isPending ? 'Salvataggio...' : 'Salva Modifiche'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale Aggiungi Regola */}
      {showAddRuleModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>➕</span> Nuova Regola Placement
              </h3>
              <button
                onClick={() => setShowAddRuleModal(false)}
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

            <form onSubmit={handleAddRule} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Tipo Regola *</label>
                <select
                  value={ruleType}
                  onChange={(e) => setRuleType(e.target.value as RuleType)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-purple-500"
                >
                  <option value="allow_node_type">allow_node_type (Consenti Tipo Nodo)</option>
                  <option value="deny_node_type">deny_node_type (Nega Tipo Nodo)</option>
                  <option value="allow_node">allow_node (Consenti Nodo Specifico)</option>
                  <option value="deny_node">deny_node (Nega Nodo Specifico)</option>
                  <option value="allow_subtree">allow_subtree (Consenti Sottoalbero)</option>
                  <option value="deny_subtree">deny_subtree (Nega Sottoalbero)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Nodo Target (Opzionale)</label>
                <select
                  value={targetNodeId}
                  onChange={(e) => setTargetNodeId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                >
                  <option value="">-- Nessuno --</option>
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} ({n.id.substring(0, 8)}...)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Tipo Nodo Target (Opzionale)</label>
                <select
                  value={targetNodeTypeId}
                  onChange={(e) => setTargetNodeTypeId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                >
                  <option value="">-- Nessuno --</option>
                  {nodeTypes.map((nt) => (
                    <option key={nt.id} value={nt.id}>
                      {nt.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Comparatore</label>
                  <input
                    type="text"
                    placeholder="EQUALS"
                    value={comparator}
                    onChange={(e) => setComparator(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Valore Testo</label>
                  <input
                    type="text"
                    placeholder="valore"
                    value={valueText}
                    onChange={(e) => setValueText(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowAddRuleModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/20 disabled:opacity-50"
                >
                  {isPending ? 'Aggiunta...' : 'Aggiungi Regola'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
