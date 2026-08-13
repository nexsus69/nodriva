'use client';

import { ConfirmModal } from '../../../../components/ui/ConfirmModal';
import { PlacementPolicyGrid } from './PlacementPolicyGrid';
import { PlacementPolicyModal } from './PlacementPolicyModal';
import { usePlacementPolicies } from '../_hooks/usePlacementPolicies';

export function PlacementPoliciesScreen() {
  const controller = usePlacementPolicies();
  return <div className="space-y-6">
    <ConfirmModal open={controller.policyToDelete !== null} title="Elimina placement policy" message={controller.policyToDelete ? `Sei sicuro di voler eliminare la Placement Policy '${controller.policyToDelete.name}'?` : ''} confirmLabel="Elimina" onCancel={() => controller.setPolicyToDelete(null)} onConfirm={controller.confirmDelete} busy={controller.isPending} />
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4"><div><h1 className="text-xl font-bold text-slate-100 flex items-center gap-2.5"><span>🗺️</span> Placement Policies (Politiche di Posizionamento)</h1><p className="text-xs text-slate-400 mt-1">Gestisci le strategie fisiche di allocazione dei dati a DB per i tipi di entità e le partizioni fisiche.</p></div><button onClick={controller.openCreate} className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/25"><span>➕</span> Nuova Placement Policy</button></div>
    {controller.error && <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300"><strong>Errore [{controller.error.code}]:</strong> {controller.error.message}</div>}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><PlacementPolicyGrid policies={controller.policies} loading={controller.loading} isPending={controller.isPending} onEdit={controller.openEdit} onDelete={controller.setPolicyToDelete} /></div>
    {controller.isEditorOpen && <PlacementPolicyModal editing={controller.editingPolicy} form={controller.form} setForm={controller.setForm} error={controller.formError} pending={controller.isPending} onClose={() => controller.setEditorOpen(false)} onSubmit={controller.submit} />}
  </div>;
}
