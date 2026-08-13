'use client';

import { ScopeAssignmentModal } from './ScopeAssignmentModal';
import { ScopeAssignmentsTable } from './ScopeAssignmentsTable';
import { useSecurityScopes } from '../_hooks/useSecurityScopes';

export function SecurityScopesScreen() {
  const controller = useSecurityScopes();
  return <div className="space-y-6">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4"><div><h1 className="text-xl font-bold text-slate-100 flex items-center gap-2.5"><span>🔒</span> Assegnazione ambiti (isolamento gerarchico)</h1><p className="text-xs text-slate-400 mt-1">Associa utenti e ruoli a nodi specifici configurando effetto e propagazione.</p></div><button type="button" onClick={controller.openCreate} className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/25"><span>➕</span> Nuova assegnazione</button></div>
    {controller.error && <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300"><strong>Errore [{controller.error.code}]:</strong> {controller.error.message}</div>}
    <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden"><ScopeAssignmentsTable scopes={controller.scopes} loading={controller.loading} isPending={controller.isPending} onEdit={controller.openEdit} onDelete={controller.remove} /></div>
    {controller.isModalOpen && <ScopeAssignmentModal editingScope={controller.editingScope} users={controller.users} roles={controller.roles} nodes={controller.nodes} selectedUserId={controller.selectedUserId} selectedNodeId={controller.selectedNodeId} selectedRoleId={controller.selectedRoleId} assignmentEffect={controller.assignmentEffect} propagation={controller.propagation} formError={controller.formError} isPending={controller.isPending} setSelectedUserId={controller.setSelectedUserId} setSelectedNodeId={controller.setSelectedNodeId} setSelectedRoleId={controller.setSelectedRoleId} setAssignmentEffect={controller.setAssignmentEffect} setPropagation={controller.setPropagation} onClose={controller.closeModal} onSubmit={controller.submit} />}
  </div>;
}
