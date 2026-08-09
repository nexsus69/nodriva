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
import { AdminModalShell } from '../../../_components/AdminModalShell';
import { PolicyRulesTable } from './_components/PolicyRulesTable';
import { PlacementRuleModal } from './_components/PlacementRuleModal';

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
          <PolicyRulesTable rules={policy.rules} isPending={isPending} onDelete={handleDeleteRule} />
        </div>
      </div>

      {/* Modale Modifica Policy */}
      {showEditPolicyModal && (
        <AdminModalShell>
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
        </AdminModalShell>
      )}

      {/* Modale Aggiungi Regola */}
      {showAddRuleModal && (
        <PlacementRuleModal
          formError={formError}
          ruleType={ruleType}
          setRuleType={setRuleType}
          targetNodeId={targetNodeId}
          setTargetNodeId={setTargetNodeId}
          targetNodeTypeId={targetNodeTypeId}
          setTargetNodeTypeId={setTargetNodeTypeId}
          comparator={comparator}
          setComparator={setComparator}
          valueText={valueText}
          setValueText={setValueText}
          nodes={nodes}
          nodeTypes={nodeTypes}
          isPending={isPending}
          onClose={() => setShowAddRuleModal(false)}
          onSubmit={handleAddRule}
        />
      )}
    </div>
  );
}
