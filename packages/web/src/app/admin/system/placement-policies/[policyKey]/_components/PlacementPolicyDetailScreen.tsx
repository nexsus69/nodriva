'use client';

import Link from '@/app/components/navigation/GuardedLink';
import { ConfirmModal } from '../../../../../components/ui/ConfirmModal';
import { AdminResourceLock } from '../../../../_components/AdminResourceLock';
import { PlacementPolicyEditModal } from './PlacementPolicyEditModal';
import { PlacementPolicyHeader } from './PlacementPolicyHeader';
import { PlacementRuleModal } from './PlacementRuleModal';
import { PolicyRulesTable } from './PolicyRulesTable';
import { usePlacementPolicyDetail } from '../_hooks/usePlacementPolicyDetail';

export function PlacementPolicyDetailScreen({ policyKey }: { policyKey: string }) {
  const controller = usePlacementPolicyDetail(policyKey);
  if (controller.loading) return <div className="p-8 text-center text-xs text-slate-400">Caricamento dettaglio policy in corso...</div>;
  if (!controller.policy) return <div className="space-y-4"><BackLink /><div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300"><strong>Errore:</strong> {controller.error?.message || 'Placement policy non trovata.'}</div></div>;
  const policy = controller.policy;
  return <div className="space-y-6">
    <AdminResourceLock resourceType="placement_policy" resourceId={policy.policyKey} />
    <ConfirmModal open={controller.showDeleteConfirm} title="Elimina placement policy" message={`Sei sicuro di voler eliminare la Placement Policy '${policy.name}'?`} confirmLabel="Elimina" onCancel={controller.cancelDeletePolicy} onConfirm={controller.confirmDeletePolicy} busy={controller.isPending} />
    <BackLink />
    <PlacementPolicyHeader policy={policy} isPending={controller.isPending} onEdit={controller.openEditPolicy} onDelete={controller.requestDeletePolicy} onAddRule={controller.openAddRule} />
    <section className="space-y-4"><h2 className="text-sm font-bold text-slate-200 uppercase font-mono tracking-wider"><span>📋</span> Regole di Posizionamento Collegate</h2><div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden"><PolicyRulesTable rules={policy.rules} isPending={controller.isPending} onDelete={controller.handleDeleteRule} /></div></section>
    {controller.showEditPolicyModal && <PlacementPolicyEditModal policyKey={policy.policyKey} name={controller.editName} description={controller.editDescription} policyMode={controller.editPolicyMode} formError={controller.formError} isPending={controller.isPending} setName={controller.setEditName} setDescription={controller.setEditDescription} setPolicyMode={controller.setEditPolicyMode} onClose={controller.closeEditPolicy} onSubmit={controller.handleUpdatePolicy} />}
    {controller.showAddRuleModal && <PlacementRuleModal formError={controller.formError} ruleType={controller.ruleType} setRuleType={controller.setRuleType} targetNodeId={controller.targetNodeId} setTargetNodeId={controller.setTargetNodeId} targetNodeTypeId={controller.targetNodeTypeId} setTargetNodeTypeId={controller.setTargetNodeTypeId} comparator={controller.comparator} setComparator={controller.setComparator} valueText={controller.valueText} setValueText={controller.setValueText} nodes={controller.nodes} nodeTypes={controller.nodeTypes} isPending={controller.isPending} onClose={controller.closeAddRule} onSubmit={controller.handleAddRule} />}
  </div>;
}

function BackLink() { return <Link href="/admin/system/placement-policies" className="text-xs text-slate-400 hover:text-slate-200 font-mono">← Torna all&apos;Elenco Policy</Link>; }
